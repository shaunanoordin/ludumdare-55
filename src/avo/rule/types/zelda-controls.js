import Rule from '@avo/rule'
import Physics from '@avo/physics'
import { LAYERS, POINTER_DEADZONE_RADIUS, POINTER_STATES, TILE_SIZE } from '@avo/constants'

/*
Standard player controls for top-down adventure games.
 */
export default class ZeldaControls extends Rule {
  constructor (app) {
    super(app)
    this._type = 'zelda-controls'
    this.inputTap = false

    this.onPointerTap = this.onPointerTap.bind(this)

    app.addEventListener('pointertap', this.onPointerTap)
  }

  deconstructor () {
    app.removeEventListener('pointertap', this.onPointerTap)
  }

  play (timeStep) {
    const app = this._app
    const hero = app.hero
    super.play(timeStep)

    if (hero) {
      const {
        keysPressed,
        pointerCurrent,
        pointerStart,
        pointerState,
      } = app.playerInput
      let intent = undefined
      let directionX = 0
      let directionY = 0

      if (pointerState === POINTER_STATES.POINTER_DOWN) {
        // Get pointer input if there's any.

        const distX = pointerCurrent.x - pointerStart.x
        const distY = pointerCurrent.y - pointerStart.y
        const pointerDistance = Math.sqrt(distX * distX + distY * distY)
        // const movementAngle = Math.atan2(distY, distX)

        if (pointerDistance > POINTER_DEADZONE_RADIUS) {
          directionX = distX / pointerDistance
          directionY = distY / pointerDistance
        }

      } else {
        // Otherwise, check for keyboard input.

        if (keysPressed['ArrowRight']) directionX++
        if (keysPressed['ArrowDown']) directionY++
        if (keysPressed['ArrowLeft']) directionX--
        if (keysPressed['ArrowUp']) directionY--
      }
      
      if (
        (keysPressed['x'] && !keysPressed['x'].acknowledged)
        || (keysPressed['X'] && !keysPressed['X'].acknowledged)
        || this.inputTap
      ) {
        intent = {
          name: 'dash',
          directionX,
          directionY,
        }
        if (keysPressed['x']) keysPressed['x'].acknowledged = true
        if (keysPressed['X']) keysPressed['X'].acknowledged = true
        this.inputTap = false

      } else if (directionX || directionY) {
        intent = {
          name: 'move',
          directionX,
          directionY,
        }
      }

      hero.intent = intent
    }
  }

  paint (layer = 0) {
    const hero = this._app.hero

    if (layer === LAYERS.HUD) {
      this.paintUIData()
      this.paintPointerInput()

    } else if (layer === LAYERS.BACKGROUND) {
      this.paintLineOfSight(hero)
    }
  }
  
  /*
  Draw UI data, such as Hero health.
   */
  paintUIData () {
    const c2d = this._app.canvas2d
    const hero = this._app.hero

    const X_OFFSET = TILE_SIZE * 1.5
    const Y_OFFSET = TILE_SIZE * -1.0
    const LEFT = X_OFFSET
    const RIGHT = this._app.canvasWidth - X_OFFSET
    const BOTTOM = this._app.canvasHeight + Y_OFFSET
    c2d.font = '2em Source Code Pro'
    c2d.textBaseline = 'bottom'
    c2d.lineWidth = 8

    const health = Math.max(hero?.health, 0) || 0
    let text = '❤️'.repeat(health)
    c2d.textAlign = 'left'
    c2d.strokeStyle = '#fff'
    c2d.strokeText(text, LEFT, BOTTOM)
    c2d.fillStyle = '#c44'
    c2d.fillText(text, LEFT, BOTTOM)

    text = hero?.action?.name + ' (' + hero?.moveSpeed.toFixed(2) + ')'
    c2d.textAlign = 'right'
    c2d.strokeStyle = '#fff'
    c2d.strokeText(text, RIGHT, BOTTOM)
    c2d.fillStyle = '#c44'
    c2d.fillText(text, RIGHT, BOTTOM)
  }

  /*
  Draw pointer input, if any. This helps players get visual feedback on their
  touchscreens.
   */
  paintPointerInput () {
    const c2d = this._app.canvas2d
    const {
      pointerCurrent,
      pointerStart,
      pointerState,
    } = this._app.playerInput
    const START_POINT_RADIUS = TILE_SIZE * 1, CURRENT_POINT_RADIUS = TILE_SIZE * 0.5
    
    if (pointerState === POINTER_STATES.POINTER_DOWN) {
      c2d.lineWidth = Math.floor(Math.min(TILE_SIZE * 0.125, 2))
      c2d.fillStyle = '#80808080'
      c2d.strokeStyle = '#80808080'

      c2d.beginPath()
      c2d.arc(pointerStart.x, pointerStart.y, START_POINT_RADIUS, 0, 2 * Math.PI)
      c2d.stroke()

      c2d.beginPath()
      c2d.arc(pointerCurrent.x, pointerCurrent.y, CURRENT_POINT_RADIUS, 0, 2 * Math.PI)
      c2d.fill()

      c2d.beginPath()
      c2d.moveTo(pointerStart.x, pointerStart.y)
      c2d.lineTo(pointerCurrent.x, pointerCurrent.y)
      c2d.stroke()
    }
  }

  /*
  Draw a line of sight (cast a ray) starting from a specified Entity (usually the
  hero), in the direction they're facing.
   */
  paintLineOfSight (srcEntity) {
    if (!srcEntity) return
    const c2d = this._app.canvas2d
    const camera = this._app.camera
    const entities = this._app.entities
    const MAX_LINE_OF_SIGHT_DISTANCE = TILE_SIZE * 5

    this._app.applyCameraTransforms()

    // Intended line of sight, i.e. a ray starting from the hero/source Entity.
    const lineOfSight = {
      start: {
        x: srcEntity.x,
        y: srcEntity.y,
      },
      end: {
        x: srcEntity.x + MAX_LINE_OF_SIGHT_DISTANCE * Math.cos(srcEntity.rotation),
        y: srcEntity.y + MAX_LINE_OF_SIGHT_DISTANCE * Math.sin(srcEntity.rotation),
      }
    }

    let actualLineOfSightEndPoint = undefined

    // For each other Entity, see if it intersects with the source Entity's LOS
    entities.forEach(entity => {
      if (entity === srcEntity) return

      // TODO: check for opaqueness and/or if the entity is visible.

      const vertices = entity.vertices
      if (vertices.length < 2) return

      // Every entity has a "shape" that can be represented by a polygon.
      // (Yes, even circles.) Check each segment (aka edge aka side) of the
      // polygon.
      for (let i = 0 ; i < vertices.length ; i++) {
        const segment = {
          start: {
            x: vertices[i].x,
            y: vertices[i].y,
          },
          end: {
            x: vertices[(i + 1) % vertices.length].x,
            y: vertices[(i + 1) % vertices.length].y,
          },
        }

        // Find the intersection. We want to find the intersection point
        // closest to the source Entity (the LOS ray's starting point).
        const intersection = Physics.getLineIntersection(lineOfSight, segment)
        if (!actualLineOfSightEndPoint || (intersection && intersection.distanceFactor < actualLineOfSightEndPoint.distanceFactor)) {
          actualLineOfSightEndPoint = intersection
        }
      }
    })

    if (!actualLineOfSightEndPoint) {
      actualLineOfSightEndPoint = {
        x: srcEntity.x + MAX_LINE_OF_SIGHT_DISTANCE* Math.cos(srcEntity.rotation),
        y: srcEntity.y + MAX_LINE_OF_SIGHT_DISTANCE * Math.sin(srcEntity.rotation),
      }
    }

    // Expected line of sight
    c2d.beginPath()
    c2d.moveTo(lineOfSight.start.x, lineOfSight.start.y)
    c2d.lineTo(lineOfSight.end.x, lineOfSight.end.y)
    c2d.strokeStyle = '#c08080'
    c2d.lineWidth = 3
    c2d.stroke()
    c2d.setLineDash([])

    // Actual line of sight
    c2d.beginPath()
    c2d.moveTo(lineOfSight.start.x, lineOfSight.start.y)
    c2d.lineTo(actualLineOfSightEndPoint.x, actualLineOfSightEndPoint.y)
    c2d.strokeStyle = '#3399ff'
    c2d.lineWidth = 3
    c2d.stroke()

    // Expected end of line of sight
    c2d.beginPath()
    c2d.arc(lineOfSight.end.x, lineOfSight.end.y, 4, 0, 2 * Math.PI)
    c2d.fillStyle = '#c08080'
    c2d.fill()

    // Actual end of line of sight
    c2d.beginPath()
    c2d.arc(actualLineOfSightEndPoint.x, actualLineOfSightEndPoint.y, 8, 0, 2 * Math.PI)
    c2d.fillStyle = '#3399ff'
    c2d.fill()

    this._app.undoCameraTransforms()
  }

  onPointerTap () {
    this.inputTap = true
  }
}
