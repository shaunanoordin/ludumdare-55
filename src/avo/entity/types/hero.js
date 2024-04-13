import Entity from '@avo/entity'
import { POINTER_STATES, TILE_SIZE, EXPECTED_TIMESTEP, LAYERS, DIRECTIONS } from '@avo/constants'

const INVULNERABILITY_WINDOW = 3000
const MOVE_ACTION_CYCLE_DURATION = 500

export default class Hero extends Entity {
  constructor (app, col = 0, row = 0) {
    super(app)
    this._type = 'hero'

    this.colour = '#000'
    this.x = col * TILE_SIZE + TILE_SIZE / 2
    this.y = row * TILE_SIZE + TILE_SIZE / 2

    this.intent = undefined
    this.action = undefined

    this.health = 3
    this.invulnerability = 0  // Invulnerability time

    this.spriteStyle = (Math.random() < 0.5) ? 'zelda' : 'toon'
  }

  /*
  Section: General Logic
  ----------------------------------------------------------------------------
   */

  play (timeStep) {
    const app = this._app
    super.play(timeStep)

    this.processIntent()
    this.processAction(timeStep)

    // Count down invulnerability time
    if (this.invulnerability > 0) {
      this.invulnerability = Math.max(this.invulnerability - timeStep, 0)
    }
  }

  paint (layer = 0) {
    const app = this._app

    if (this.invulnerability > 0) {  // If invulnerable, flash!
      const flash = Math.floor(this.invulnerability / 300) % 2
      if (flash === 1) return
    }

    this.colour = (app.playerInput.pointerState === POINTER_STATES.POINTER_DOWN)
      ? '#e42'
      : '#c44'
    super.paint(layer)

    const c2d = app.canvas2d
    const camera = app.camera
    const animationSpriteSheet = (this.spriteStyle === 'zelda')
      ? app.assets['hero-4dir']
      : app.assets['hero-2dir']
    if (!animationSpriteSheet) return

    this._app.applyCameraTransforms()

    const SPRITE_SIZE = (this.spriteStyle === 'zelda') ? 48 : 32
    const FLIP_SPRITE = (this.spriteStyle === 'toon' && this.getSpriteDirectionEW() === DIRECTIONS.WEST) ? -1 : 1
    const SPRITE_SCALE = 2 *
      (Math.min((this.health / 3), 1) * 0.5 + 0.5)  // Shrink after taking damage

    // Draw any special vfx
    const action = this.action
    if (action?.name === 'dash' && action?.state === 'execution' && layer === LAYERS.ENTITIES_LOWER) {
      // Draw a "dash line"
      const dashLength = this.size * 2
      const dashWidth = this.size
      const dashTailX = this.x - dashLength * Math.cos(this.rotation)
      const dashTailY = this.y - dashLength * Math.sin(this.rotation)
      c2d.beginPath()
      c2d.moveTo(this.x, this.y)
      c2d.lineTo(dashTailX, dashTailY)
      c2d.strokeStyle = 'rgba(255, 255, 0, 0.5)'
      c2d.lineWidth = dashWidth
      c2d.stroke()
    }

    // Draw the sprite
    if (layer === LAYERS.ENTITIES_LOWER) {
      const srcX = this.getSpriteCol() * SPRITE_SIZE
      const srcY = this.getSpriteRow() * SPRITE_SIZE
      const sizeX = SPRITE_SIZE
      const sizeY = SPRITE_SIZE

      c2d.translate(this.x, this.y)  // 1. This moves the 'drawing origin' to match the position of (the centre of) the Entity.
      c2d.scale(SPRITE_SCALE * FLIP_SPRITE, SPRITE_SCALE)  // 2. This ensures the sprite scales with the 'drawing origin' as the anchor point.
      // c2d.rotate(this.rotation)  // 3. If we wanted to, we could rotate the sprite around the 'drawing origin'.

      // 4. tgtX and tgtY specify where to draw the sprite, relative to the 'drawing origin'.
      const tgtX = -sizeX / 2  // Align centre of sprite to origin
      const tgtY = (this.spriteStyle === 'zelda')
        ? -sizeY * 0.75  // Align bottom(-ish) of sprite to origin
        : -sizeY * 7/8

      c2d.drawImage(animationSpriteSheet.img,
        srcX, srcY, sizeX, sizeY,
        tgtX, tgtY, sizeX, sizeY
      )
    }

    this._app.undoCameraTransforms()
  }

  /*
  Section: Game Logic
  ----------------------------------------------------------------------------
   */

  applyEffect (effect, source) {
    super.applyEffect(effect, source)
    if (!effect) return

    if (effect.name === 'damage') {
      if (this.invulnerability === 0) {
        this.health = Math.max(this.health - 1, 0)
        this.invulnerability = INVULNERABILITY_WINDOW
      }
    }
  }

  /*
  Section: Intent and Actions
  ----------------------------------------------------------------------------
   */

  /*
  Translate intent into action.
   */
  processIntent () {
    // Failsafe
    if (!this.action) this.goIdle()

    const action = this.action
    const intent = this.intent

    if (!intent) {  // Go idle
      if (action?.name === 'move') this.goIdle()
    } else {  // Perform a new action
      // Note: every 'move' action is considered a new action

      if (action?.name === 'idle' || action?.name === 'move' )  {  // Can the action be overwritten by a new action? If not, the action must play through to its finish.
        this.action = {
          ...intent,
          name: intent.name,
          counter: (action.name === intent.name) ? action.counter : 0,  // If the current action and new intent have the same name, it's just a continuation of the idle or move action, but with other new values (e.g. new directions)
        }
      }
    }
  }

  /*
  Perform the action.
   */
  processAction (timeStep) {
    if (!this.action) return

    const action = this.action

    if (action.name === 'idle') {

      // Do nothing

    } else if (action.name === 'move') {

      const moveAcceleration = this.moveAcceleration * timeStep / EXPECTED_TIMESTEP || 0
      const directionX = action.directionX || 0
      const directionY = action.directionY || 0
      const actionRotation = Math.atan2(directionY, directionX)

      this.moveX += moveAcceleration * Math.cos(actionRotation)
      this.moveY += moveAcceleration * Math.sin(actionRotation)
      this.rotation = actionRotation

      action.counter = (action.counter + timeStep) % MOVE_ACTION_CYCLE_DURATION

    } else if (action.name === 'dash') {
      const WINDUP_DURATION = EXPECTED_TIMESTEP * 5
      const EXECUTION_DURATION = EXPECTED_TIMESTEP * 2
      const WINDDOWN_DURATION = EXPECTED_TIMESTEP * 10
      const PUSH_POWER = this.size * 0.3
      const MAX_PUSH = EXECUTION_DURATION / 1000 * 60 * PUSH_POWER

      if (!action.state) {  // Trigger only once, at the start of the action

        // Figure out the initial direction of the dash
        const directionX = action.directionX  || 0
        const directionY = action.directionY  || 0
        this.rotation = (directionX === 0 && directionY === 0)
          ? this.rotation
          : Math.atan2(directionY, directionX)
        action.rotation = this.rotation  // Records the initial direction of the dash

        action.state = 'windup'
      }

      if (action.state === 'windup') {
        action.counter += timeStep
        if (action.counter >= WINDUP_DURATION) {
          action.state = 'execution'
          action.counter = 0
        }
      } else if (action.state === 'execution') {
        const modifiedTimeStep = Math.min(timeStep, EXECUTION_DURATION - action.counter)
        const pushPower = PUSH_POWER * modifiedTimeStep / EXPECTED_TIMESTEP
        this.pushX += pushPower * Math.cos(action.rotation)
        this.pushY += pushPower * Math.sin(action.rotation)

        action.counter += modifiedTimeStep
        if (action.counter >= EXECUTION_DURATION) {
          action.state = 'winddown'
          action.counter = 0
        }
      } else if (action.state === 'winddown') {
        action.counter += timeStep
        if (action.counter >= WINDDOWN_DURATION) {
          this.goIdle()
        }
      }
    }
  }

  goIdle () {
    this.action = {
      name: 'idle',
      counter: 0,
    }
  }

  /*
  Section: Event Handling
  ----------------------------------------------------------------------------
   */

  /*
  Triggers when this entity hits/touches/intersects with another.
   */
  onCollision (target, collisionCorrection) {
    super.onCollision(target, collisionCorrection)
    if (!target) return
  }

  /*
  Section: Physics/Getters and Setters
  ----------------------------------------------------------------------------
   */

  get moveDeceleration () {
    if (this.action?.name === 'move') return 0
    return this._moveDeceleration
  }

  get pushDeceleration () {
    if (this.action?.name === 'dash' && this.action?.state === 'execution') return 0
    return this._pushDeceleration
  }

  /*
  Section: Animation
  ----------------------------------------------------------------------------
   */
  getSpriteCol () {
    if (this.spriteStyle === 'zelda') {
      switch (this.getSpriteDirection()) {
        case DIRECTIONS.NORTH: return 1
        case DIRECTIONS.EAST: return 2
        case DIRECTIONS.SOUTH: return 0
        case DIRECTIONS.WEST: return 3
      }
    } else if (this.spriteStyle === 'toon') {
      return (this.getSpriteDirectionNS() === DIRECTIONS.NORTH) ? 1 : 0
    }
    return 0
  }

  getSpriteRow () {
    const action = this.action
    if (!action) return 0

    if (this.spriteStyle === 'zelda') {
      if (action.name === 'move') {
        const progress = action.counter / MOVE_ACTION_CYCLE_DURATION
        if (progress < 0.3) return 2
        else if (progress < 0.5) return 1
        else if (progress < 0.8) return 3
        else if (progress < 1) return 1
      } else if (action.name === 'dash') {
        if (action.state === 'windup') return 4
        else if (action.state === 'execution') return 1
        else if (action.state === 'winddown') return 1
      }
    } else if (this.spriteStyle === 'toon') {
      if (action.name === 'move') {
        const progress = action.counter / (MOVE_ACTION_CYCLE_DURATION)
        if (progress < 0.5) return 2
        else return 1
      }
    }

    return 0
  }
}
