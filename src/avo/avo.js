import {
  TILE_SIZE,
  POINTER_STATES,
  MIN_LAYER, MAX_LAYER,
  EXPECTED_TIMESTEP,
  POINTER_DEADZONE_RADIUS,
  POINTER_TAP_DURATION,
} from '@avo/constants'
import Physics from '@avo/physics'
import ExampleStory from '@avo/story/types/example-story'
import Interaction from '@avo/interaction'

const searchParams = new URLSearchParams(window.location.search)
const DEBUG = searchParams.get('debug') || false

export default class AvO {
  constructor (args = {}) {
    const {
      story = ExampleStory,
      width = 24 * TILE_SIZE,  // Canvas width
      height = 16 * TILE_SIZE,  // Canvas height
    } = args

    this.html = {
      main: document.getElementById('main'),
      canvas: document.getElementById('canvas'),
      homeMenu: document.getElementById('home-menu'),
      interactionMenu: document.getElementById('interaction-menu'),
      buttonHome: document.getElementById('button-home'),
      buttonFullscreen: document.getElementById('button-fullscreen'),
      buttonReload: document.getElementById('button-reload'),
    }

    this.homeMenu = false
    this.setHomeMenu(false)

    this.interactionMenu = false
    this.setInteractionMenu(false)

    this.canvas2d = this.html.canvas.getContext('2d')
    this.canvasWidth = width
    this.canvasHeight = height
    this._canvasHasCameraTransforms = false  // Safety check

    this.camera = {
      target: null,  // Target entity to follow. If null, camera is static.
      x: 0,
      y: 0,
      zoom: 1,
    }

    this.setupUI()

    this.initialised = false

    this.hero = null
    this.entities = []
    this.tiles = []
    this.rules = new Map()
    this.story = (story) ? new story(this) : undefined
    this.assets = this.story?.assets || {}
    this.secretAssets = {}

    this.eventListeners = {
      'keydown': [],
      'keyup': [],
      'pointerdown': [],
      'pointermove': [],
      'pointerup': [],
      'pointertap': [],
      'pointerholdend': [],
    }

    this.playerInput = {}
    this.resetPlayerInput()
    
    this.timeAccumulator = 0
    this.prevTime = null
    this.nextFrame = window.requestAnimationFrame(this.main.bind(this))
  }

  initialisationCheck () {
    // Assets check
    let allAssetsReady = true
    let numReadyAssets = 0
    let numTotalAssets = 0
    Object.keys(this.assets).forEach((id) => {
      const asset = this.assets[id]
      allAssetsReady = allAssetsReady && asset.ready
      if (asset.ready) numReadyAssets++
      numTotalAssets++
    })
    Object.keys(this.secretAssets).forEach((id) => {
      const secretAsset = this.secretAssets[id]
      const secretAssetIsReady = secretAsset.ready || secretAsset.error
      allAssetsReady = allAssetsReady && secretAssetIsReady
      if (secretAssetIsReady) numReadyAssets++
      numTotalAssets++
    })

    // Paint status
    this.canvas2d.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    this.canvas2d.textAlign = 'start'
    this.canvas2d.textBaseline = 'top'
    this.canvas2d.fillStyle = '#ccc'
    this.canvas2d.font = `1em monospace`
    this.canvas2d.fillText(`Loading ${numReadyAssets} / ${numTotalAssets} `, TILE_SIZE, TILE_SIZE)

    if (allAssetsReady) {
      // Clean up secret assets
      Object.keys(this.secretAssets).forEach((id) => {
        if (this.secretAssets[id].error) delete this.secretAssets[id]
      })

      // Let's go!
      this.initialised = true
      this.showUI()
      this.story?.start()
    }
  }

  /*
  Section: General Logic
  ----------------------------------------------------------------------------
   */

  /*
  The main loop. Run a single frame of gameplay.
  - time: the current/total time (milliseconds) since the game started.
   */
  main (time) {
    const timeStep = (this.prevTime) ? time - this.prevTime : time
    this.prevTime = time
    this.timeAccumulator += timeStep

    // Sanity/safety check: timeStep can be huge
    // e.g. if player pauses game by switching windows.
    this.timeAccumulator = Math.min(this.timeAccumulator, EXPECTED_TIMESTEP * 10) 

    if (this.initialised) {
      // Keep a consistent "frame rate" for logic processing
      while (this.timeAccumulator >= EXPECTED_TIMESTEP) {
        this.play(EXPECTED_TIMESTEP)
        this.timeAccumulator -= EXPECTED_TIMESTEP
        // TODO: add safety counter to prevent excessively long while() loops.
      }
      // Paint whenever possible
      this.paint()
    } else {
      this.initialisationCheck()
    }

    this.nextFrame = window.requestAnimationFrame(this.main.bind(this))
  }

  /*
  Run the gameplay/physics logic for a single frame.
  - timeStep: the time (milliseconds) since the last frame.
    We expect 60 frames per second.
   */
  play (timeStep) {
    // If a menu is open, pause all action gameplay
    if (this.homeMenu || this.interactionMenu) return

    // Run the action gameplay
    // ----------------
    this.rules.forEach(rule => rule.play(timeStep))

    this.entities.forEach(entity => entity.play(timeStep))
    this.checkCollisions(timeStep)

    // Cleanup: entities
    this.entities.filter(entity => entity._expired).forEach(entity => entity.deconstructor())
    this.entities = this.entities.filter(entity => !entity._expired)

    // Cleanup: rules
    this.rules.forEach((rule, id) => {
      if (rule.expired) {
        rule.deconstructor()
        this.rules.delete(id)
      }
    })

    // Sort Entities along the y-axis, for paint()/rendering purposes.
    // WARNING: inefficient
    this.entities.sort((a, b) => a.y - b.y)
    // ----------------

    // Increment the duration of each currently pressed key
    Object.keys(this.playerInput.keysPressed).forEach(key => {
      if (this.playerInput.keysPressed[key]) this.playerInput.keysPressed[key].duration += timeStep
    })

    // Increment the duration of the pointer being active
    if (this.playerInput.pointerState === POINTER_STATES.POINTER_DOWN) {
      this.playerInput.pointerDownDuration += timeStep
    }
  }

  /*
  Paint/draw the game visuals onto the canvas.
   */
  paint () {
    const c2d = this.canvas2d
    const camera = this.camera

    // Camera Controls: focus the camera on the target entity, if any.
    // ----------------
    if (camera.target) {
      camera.x = this.canvasWidth / 2 - camera.target.x * camera.zoom
      camera.y = this.canvasHeight / 2 - camera.target.y * camera.zoom
    }

    c2d.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    c2d.resetTransform()

    c2d.strokeStyle = 'rgba(128, 128, 128, 0.05)'
    c2d.lineWidth = 2
    // ----------------

    // Draw grid
    // ----------------
    const GRID_SIZE = TILE_SIZE * camera.zoom
    const offsetX = (this.camera.x % GRID_SIZE) - GRID_SIZE
    const offsetY = (this.camera.y % GRID_SIZE) - GRID_SIZE

    for (let y = offsetY ; y < this.canvasHeight ; y += GRID_SIZE) {
      for (let x = offsetX ; x < this.canvasWidth ; x += GRID_SIZE) {
        c2d.beginPath()
        c2d.rect(x, y, GRID_SIZE, GRID_SIZE)
        c2d.stroke()

        // Debug Grid
        if (DEBUG) {
          c2d.fillStyle = '#ccc'
          c2d.font = `${camera.zoom * 0.5}em Source Code Pro`
          c2d.textAlign = 'center'
          c2d.textBaseline = 'middle'
          const col = Math.floor((x - this.camera.x) / GRID_SIZE)
          const row = Math.floor((y - this.camera.y) / GRID_SIZE)
          c2d.fillText(col + ',' + row, x + GRID_SIZE / 2, y + GRID_SIZE / 2)  // using template strings here messes up colours in Brackets.
        }
      }
    }
    // ----------------

    // Draw entities and other elements
    // ----------------
    const MAP_WIDTH = 24
    const MAP_HEIGHT = 24
    for (let layer = MIN_LAYER ; layer <= MAX_LAYER ; layer++) {
      for (let row = 0 ; row < MAP_HEIGHT ; row++) {
        for (let col = 0 ; col < MAP_WIDTH ; col++) {
          this.tiles[row][col].paint(layer)
        }
      }

      this.entities.forEach(entity => entity.paint(layer))
      this.rules.forEach(rule => rule.paint(layer))
    }
    // ----------------
  }

  /*
  Section: UI
  ----------------------------------------------------------------------------
   */

  setupUI () {
    this.html.canvas.width = this.canvasWidth
    this.html.canvas.height = this.canvasHeight
    this.canvas2d.imageSmoothingEnabled = false  /* Pixel art: Maintains sprites' pixel sharpness when scaled up via drawImage() */

    if (window.PointerEvent) {
      this.html.canvas.addEventListener('pointerdown', this.onPointerDown.bind(this))
      this.html.canvas.addEventListener('pointermove', this.onPointerMove.bind(this))
      this.html.canvas.addEventListener('pointerup', this.onPointerUp.bind(this))
      this.html.canvas.addEventListener('pointercancel', this.onPointerUp.bind(this))
    } else {
      this.html.canvas.addEventListener('mousedown', this.onPointerDown.bind(this))
      this.html.canvas.addEventListener('mousemove', this.onPointerMove.bind(this))
      this.html.canvas.addEventListener('mouseup', this.onPointerUp.bind(this))
    }

    // Prevent "touch and hold to open context menu" menu on touchscreens.
    this.html.canvas.addEventListener('touchstart', stopEvent)
    this.html.canvas.addEventListener('touchmove', stopEvent)
    this.html.canvas.addEventListener('touchend', stopEvent)
    this.html.canvas.addEventListener('touchcancel', stopEvent)

    this.html.buttonHome.addEventListener('click', this.buttonHome_onClick.bind(this))
    this.html.buttonFullscreen.addEventListener('click', this.buttonFullscreen_onClick.bind(this))
    this.html.buttonReload.addEventListener('click', this.buttonReload_onClick.bind(this))

    this.html.main.addEventListener('keydown', this.onKeyDown.bind(this))
    this.html.main.addEventListener('keyup', this.onKeyUp.bind(this))

    window.addEventListener('resize', this.updateUI.bind(this))
    this.updateUI()
    this.hideUI()  // Hide until all assets are ready

    this.html.main.focus()
  }

  hideUI () {
    this.html.buttonHome.style.visibility = 'hidden'
    this.html.buttonReload.style.visibility = 'hidden'
  }

  showUI () {
    this.html.buttonHome.style.visibility = 'visible'
    this.html.buttonReload.style.visibility = 'visible'
  }

  updateUI () {
    // Fit the interaction layers (menus, etc) to the canvas
    const mainDivBounds = this.html.main.getBoundingClientRect()
    const canvasBounds = this.html.canvas.getBoundingClientRect()

    this.html.homeMenu.style.width = `${canvasBounds.width}px`
    this.html.homeMenu.style.height = `${canvasBounds.height}px`
    this.html.homeMenu.style.top = `${canvasBounds.top - mainDivBounds.top}px`
    this.html.homeMenu.style.left = `${canvasBounds.left}px`

    this.html.interactionMenu.style.width = `${canvasBounds.width}px`
    this.html.interactionMenu.style.height = `${canvasBounds.height}px`
    this.html.interactionMenu.style.top = `${canvasBounds.top - mainDivBounds.top}px`
    this.html.interactionMenu.style.left = `${canvasBounds.left}px`
  }

  setHomeMenu (homeMenu) {
    this.homeMenu = homeMenu
    if (homeMenu) {
      this.html.homeMenu.style.visibility = 'visible'
      this.html.buttonReload.style.visibility = 'hidden'
    } else {
      this.html.homeMenu.style.visibility = 'hidden'
      this.html.buttonReload.style.visibility = 'visible'
      this.html.main.focus()
    }
  }

  setInteractionMenu (interactionMenu) {
    const div = this.html.interactionMenu

    this.interactionMenu && this.interactionMenu.unload()  // Unload the old menu, if any
    this.interactionMenu = interactionMenu  // Set the new menu

    if (interactionMenu) {
      while (div.firstChild) { div.removeChild(div.firstChild) }  // Clear div
      interactionMenu.load(div)  // load the new menu
      div.style.visibility = 'visible'
    } else {
      div.style.visibility = 'hidden'
      this.html.main.focus()
    }
  }

  /*
  Section: Event Handling
  ----------------------------------------------------------------------------
   */

  addEventListener (eventName, listener) {
    this.eventListeners?.[eventName]?.push(listener)
  }

  removeEventListener (eventName, listener) {
    if (!this.eventListeners?.[eventName]) return
    this.eventListeners[eventName] = this.eventListeners?.[eventName].filter(l => l !== listener)
  }

  broadcastEvent (eventName, args) {
    this.eventListeners?.[eventName]?.forEach(eventHandler => {
      eventHandler(args)
    })
  }

  onPointerDown (e) {
    const coords = getEventCoords(e, this.html.canvas)

    // Initialise
    this.playerInput.pointerState = POINTER_STATES.POINTER_DOWN
    this.playerInput.pointerStart = coords
    this.playerInput.pointerCurrent = coords
    this.playerInput.pointerEnd = undefined

    this.playerInput.pointerTapOrHold = true
    this.playerInput.pointerDownDuration = 0

    this.html.main.focus()

    this.broadcastEvent('pointerdown', { coords })
    return stopEvent(e)
  }

  onPointerMove (e) {
    const coords = getEventCoords(e, this.html.canvas)

    this.playerInput.pointerCurrent = coords

    // If the pointer never moves far from the initial position, then the
    // pointer interaction is considered a tap or hold.
    if (
      this.playerInput.pointerState === POINTER_STATES.POINTER_DOWN
      && this.playerInput.pointerTapOrHold
    ) {
      const distX = this.playerInput.pointerCurrent.x - this.playerInput.pointerStart.x
      const distY = this.playerInput.pointerCurrent.y - this.playerInput.pointerStart.y
      const pointerDistance = Math.sqrt(distX * distX + distY * distY)
      if (pointerDistance > POINTER_DEADZONE_RADIUS) {
        this.playerInput.pointerTapOrHold = false
      }
    }

    this.broadcastEvent('pointermove', { coords })
    return stopEvent(e)
  }

  onPointerUp (e) {
    const coords = getEventCoords(e, this.html.canvas)

    if (this.playerInput.pointerState === POINTER_STATES.POINTER_DOWN) {
      this.playerInput.pointerEnd = coords
      this.playerInput.pointerState = POINTER_STATES.IDLE

      // Is the pointer action a tap or hold action?
      if (this.playerInput.pointerTapOrHold) {
        if (this.playerInput.pointerDownDuration <= POINTER_TAP_DURATION) {
          this.broadcastEvent('pointertap', { coords })
        } else {
          this.broadcastEvent('pointerholdend', { coords, duration: this.playerInput.pointerDownDuration })
        }
      }
    }

    this.broadcastEvent('pointerup', { coords })
    return stopEvent(e)
  }

  onKeyDown (e) {
    // Special cases
    switch (e.key) {
      // Open home menu
      case 'Escape':
        this.setHomeMenu(!this.homeMenu)
        break

      /*
      // DEBUG
      case 'z':
        if (!this.interactionMenu) {
          this.setInteractionMenu(new Interaction(this))
        }
        break

      // DEBUG
      case 'c':
        if (this.hero?.spriteStyle === 'toon') {
          this.hero.spriteStyle = 'zelda'
        } else if (this.hero?.spriteStyle === 'zelda') {
          this.hero.spriteStyle = 'toon'
        }
        break
      */

      case '-':
      case '_':
        this.camera.zoom = Math.max(0.5, this.camera.zoom - 0.5)
        break

      case '+':
      case '=':
        this.camera.zoom = Math.min(4, this.camera.zoom + 0.5)
        break
    }

    // General input
    if (!this.playerInput.keysPressed[e.key]) {
      this.playerInput.keysPressed[e.key] = {
        duration: 0,
        acknowledged: false,
      }
    }
    this.broadcastEvent('keydown', { key: e.key })
  }

  onKeyUp (e) {
    const duration = this.playerInput.keysPressed[e.key]?.duration || 0
    this.playerInput.keysPressed[e.key] = undefined
    this.broadcastEvent('keyup', { key: e.key, duration })
  }

  buttonHome_onClick () {
    this.setHomeMenu(!this.homeMenu)
  }

  buttonFullscreen_onClick () {
    const isFullscreen = document.fullscreenElement
    if (!isFullscreen) {
      if (this.html.main.requestFullscreen) {
        this.html.main.requestFullscreen().then(() => {
          this.html.main.className = 'fullscreen'
          this.updateUI()
        }).catch(err => {
          console.error('requestFullscreen() error: ', err)
        })
      }
    } else {
      document.exitFullscreen?.().then(() => {
        this.html.main.className = ''
        this.updateUI()
      }).catch(err => {
        console.error('exitFullscreen() error: ', err)
      })
    }
  }

  buttonReload_onClick () {
    this.story?.reload()
  }

  /*
  Section: Gameplay
  ----------------------------------------------------------------------------
   */

  addEntity (entity) {
    if (!entity) return null
    if (!this.entities.includes(entity)) this.entities.push(entity)
    return entity
  }

  removeEntity (entityOrMatchingFn) {
    if (!entityOrMatchingFn) return
    if (typeof entityOrMatchingFn === 'function') {
      this.entities.filter(entityOrMatchingFn).forEach(entity => {
        entity._expired = true
      })
    } else if (this.entities.includes(entityOrMatchingFn)) {
      entityOrMatchingFn._expired = true
    }
  }

  addRule (rule) {
    if (!rule) return
    const id = rule._type
    this.rules.set(id, rule)
  }

  clearRules () {
    this.rules.forEach((rule, id) => {
      rule.deconstructor()
      this.rules.delete(id)
    })
  }

  /*
  Section: Painting
  ----------------------------------------------------------------------------
   */

  /*
  Applies camera transforms to the canvas.
  Should be run right before drawing an Entity (or etc) so the object is drawn
  relative to the camera's view.
   */
  applyCameraTransforms () {
    if (this._canvasHasCameraTransforms) throw new Error('Canvas already has camera transforms.')
    this._canvasHasCameraTransforms = true
    const c2d = this.canvas2d
    const camera = this.camera
    c2d.save()
    c2d.translate(camera.x, camera.y)
    c2d.scale(camera.zoom, camera.zoom)
  }

  /*
  Removes camera transforms from the canvas.
   */
  undoCameraTransforms () {
    if (!this._canvasHasCameraTransforms) throw new Error('Canvas doesn\'t have camera transforms.')
    this._canvasHasCameraTransforms = false
    this.canvas2d.restore()
  }

  /*
  Section: Misc
  ----------------------------------------------------------------------------
   */

  checkCollisions (timeStep) {
    for (let a = 0 ; a < this.entities.length ; a++) {
      let entityA = this.entities[a]

      for (let b = a + 1 ; b < this.entities.length ; b++) {
        let entityB = this.entities[b]
        let collisionCorrection = Physics.checkCollision(entityA, entityB)

        if (collisionCorrection) {
          entityA.onCollision(entityB, collisionCorrection.a)
          entityB.onCollision(entityA, collisionCorrection.b)
        }
      }

      const range = Math.ceil(entityA.size / TILE_SIZE)
      for (let row = entityA.row - range ; row <= entityA.row + range ; row++) {
        for (let col = entityA.col - range ; col <= entityA.col + range ; col++) {
          const tile = this.tiles?.[row]?.[col]
          let collisionCorrection = Physics.checkCollision(entityA, tile)

          if (collisionCorrection) {
            entityA.onCollision(tile, collisionCorrection.a)
            tile.onCollision(entityA, collisionCorrection.b)
          }
        }
      }
    }
  }

  resetPlayerInput () {
    this.playerInput = {
      // Pointer (mouse/touchscreen) input
      // pointerStart/pointerCurrent/pointerEnd = { x, y } 
      pointerState: POINTER_STATES.IDLE,
      pointerStart: undefined,
      pointerCurrent: undefined,
      pointerEnd: undefined,

      // Pointer metadata
      pointerTapOrHold: true, // A pointer interaction is a tap or hold if the pointer never travels far from its initial position (i.e. never left the deadzone).
      pointerDownDuration: 0,

      // Keyboard input
      // keysPressed = { key: { duration, acknowledged } }
      keysPressed: {},
    }
  }
}

function getEventCoords (event, element) {
  const xRatio = (element.width && element.offsetWidth) ? element.width / element.offsetWidth : 1
  const yRatio = (element.height && element.offsetHeight) ? element.height / element.offsetHeight : 1

  const x = event.offsetX * xRatio
  const y = event.offsetY * yRatio
  return { x, y }
}

function stopEvent (e) {
  if (!e) return false
  e.preventDefault && e.preventDefault()
  e.stopPropagation && e.stopPropagation()
  e.returnValue = false
  e.cancelBubble = true
  return false
}
