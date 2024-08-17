import {
  TILE_SIZE, ROTATIONS, DIRECTIONS, SHAPES, EXPECTED_TIMESTEP, LAYERS,
} from '@avo/constants'

const MOVE_MAX_SPEED_MODIFIER = 4
const PUSH_MAX_SPEED_MODIFIER = 32
const MOVE_ACCELERATION_MODIFIER = 0.4
const MOVE_DECELERATION_MODIFIER = 0.4
const PUSH_DECELERATION_MODIFIER = 0.1

const MASS_TO_LINEWIDTH_RATIO = 5

export default class Entity {
  constructor (app) {
    this._app = app
    this._type = 'entity'
    this.name = ''  // Optional identifier

    // General entity attributes
    this.colour = '#ccc'

    // Expired entities are removed at the end of the cycle.
    this._expired = false

    // Positional data
    this.x = 0
    this.y = 0
    this.size = TILE_SIZE
    this._rotation = ROTATIONS.SOUTH  // Rotation in radians
    this.shape = SHAPES.CIRCLE
    this.shapePolygonPath = null  // Only applicable if shape === SHAPES.POLYGON

    // Physics (movement): self locomotion and external (pushed) movement.
    this.moveX = 0
    this.moveY = 0
    this.pushX = 0
    this.pushY = 0

    // Additional physics
    this._solid = true
    this._movable = true
    this._mass = 10  // Only matters if solid && movable
    this._moveAcceleration = MOVE_ACCELERATION_MODIFIER
    this._moveDeceleration = MOVE_DECELERATION_MODIFIER
    this._moveMaxSpeed = MOVE_MAX_SPEED_MODIFIER
    this._pushDeceleration = PUSH_DECELERATION_MODIFIER
    this._pushMaxSpeed = PUSH_MAX_SPEED_MODIFIER

    // Additional animation
    this._spriteDirectionEW = DIRECTIONS.EAST  // Only used for 2-directional toon-style sprites
    this._spriteDirectionNS = DIRECTIONS.SOUTH
  }

  deconstructor () {}

  /*
  Section: General Logic
  ----------------------------------------------------------------------------
   */

  play (timeStep) {
    // Update position
    const timeCorrection = (timeStep / EXPECTED_TIMESTEP)
    this.x += (this.moveX + this.pushX) * timeCorrection
    this.y += (this.moveY + this.pushY) * timeCorrection

    // Upkeep: deceleration
    this.doMoveDeceleration(timeStep)
    this.doPushDeceleration(timeStep)

    // Upkeep: limit speed
    this.doMaxSpeedLimit()
  }

  /*
  Paint entity's hitbox.
   */
  paint (layer = 0) {
    const c2d = this._app.canvas2d
    this._app.applyCameraTransforms()

    if (layer === LAYERS.ENTITIES_LOWER) {
      c2d.fillStyle = this.colour
      c2d.strokeStyle = '#444'
      c2d.lineWidth = this.mass / MASS_TO_LINEWIDTH_RATIO

      // Draw shape outline
      switch (this.shape) {
        case SHAPES.CIRCLE:
          c2d.beginPath()
          c2d.arc(this.x, this.y, this.size / 2, 0, 2 * Math.PI)
          c2d.fill()
          this.solid && c2d.stroke()
          break
        case SHAPES.SQUARE:
          c2d.beginPath()
          c2d.rect(this.x - this.size / 2, this.y - this.size / 2, this.size, this.size)
          c2d.fill()
          this.solid && c2d.stroke()
          break
        case SHAPES.POLYGON:
          c2d.beginPath()
          let coords = this.vertices
          if (coords.length >= 1) c2d.moveTo(coords[coords.length-1].x, coords[coords.length-1].y)
          for (let i = 0 ; i < coords.length ; i++) {
            c2d.lineTo(coords[i].x, coords[i].y)
          }
          c2d.closePath()
          c2d.fill()
          this.solid && c2d.stroke()
          break
      }

      // Draw anchor point, mostly for debugging
      c2d.strokeStyle = 'rgba(255, 255, 255, 0.5)'
      c2d.beginPath()
      c2d.arc(this.x, this.y, 2, 0, 2 * Math.PI)  // Anchor point
      if (this.shape === SHAPES.CIRCLE) {  // Direction line
        c2d.moveTo(
          this.x + this.size * 0.1 * Math.cos(this.rotation),
          this.y + this.size * 0.1 * Math.sin(this.rotation)
        )
        c2d.lineTo(
          this.x + this.size * 0.5 * Math.cos(this.rotation),
          this.y + this.size * 0.5 * Math.sin(this.rotation)
        )
      }
      c2d.stroke()
    }

    this._app.undoCameraTransforms()
  }

  /*
  Section: Game Logic
  ----------------------------------------------------------------------------
   */

  /*
  Applies an effect to this entity. Usually called by another antity.
  e.g. a fireball hits this character and applies an "ON FIRE" effect.
   */
  applyEffect (effect, source) {}

  /*
  Section: Event Handling
  ----------------------------------------------------------------------------
   */

  /*
  Triggers when this entity hits/touches/intersects with another.
   */
  onCollision (target, collisionCorrection) {
    this.doBounce(target, collisionCorrection)
    this.x = collisionCorrection.x
    this.y = collisionCorrection.y
  }

  /*
  Section: Physics
  ----------------------------------------------------------------------------
   */

  /*
  By default, every moving entity decelerates (because we don't exist in a
  perfect vacuum and the game doesn't take place on a slippery ice).
  Entities can intentionally override this logic,
  e.g. "if a hero is walking, ignore deceleration."
   */
  doMoveDeceleration (timeStep) {
    const timeCorrection = (timeStep / EXPECTED_TIMESTEP)
    const moveDeceleration = this.moveDeceleration * timeCorrection || 0
    const curRotation = Math.atan2(this.moveY, this.moveX)
    const newMoveSpeed = Math.max(0, this.moveSpeed - moveDeceleration)
    this.moveX = newMoveSpeed * Math.cos(curRotation)
    this.moveY = newMoveSpeed * Math.sin(curRotation)
  }

  doPushDeceleration (timeStep) {
    const timeCorrection = (timeStep / EXPECTED_TIMESTEP)
    const pushDeceleration = this.pushDeceleration * timeCorrection || 0
    const curRotation = Math.atan2(this.pushY, this.pushX)
    const newPushSpeed = Math.max(0, this.pushSpeed - pushDeceleration)
    this.pushX = newPushSpeed * Math.cos(curRotation)
    this.pushY = newPushSpeed * Math.sin(curRotation)
  }

  /*
  Every entity has a maximum speed limit. Intentional movement speed and
  external force movement speed are treated separately.
   */
  doMaxSpeedLimit () {
    // Limit max move speed
    if (this.moveMaxSpeed >= 0) {
      const correctedSpeed = Math.min(this.moveMaxSpeed, this.moveSpeed)
      const moveAngle = this.moveAngle
      this.moveX = correctedSpeed * Math.cos(moveAngle)
      this.moveY = correctedSpeed * Math.sin(moveAngle)
    }

    // Limit max push speed
    if (this.pushMaxSpeed >= 0) {
      const correctedSpeed = Math.min(this.pushMaxSpeed, this.pushSpeed)
      const pushAngle = this.pushAngle
      this.pushX = correctedSpeed * Math.cos(pushAngle)
      this.pushY = correctedSpeed * Math.sin(pushAngle)
    }
  }

  /*
  When a solid pushed entity hits another solid entity, momentum is transferred.
  Usually, this leads to elastic collisions, because that chaos is fun!
   */
  doBounce (target, collisionCorrection) {
    // If this object isn't a movable solid, it can't bounce.
    if (!(this.movable && this.solid)) return

    if (  // this object is bouncing off an unmovable object
      this.movable && this.solid
      && !target.movable && target.solid
    ) {
      if (
        this.shape === SHAPES.CIRCLE && target.shape === SHAPES.CIRCLE
      ) {

        // For circle + circle collisions, the collision correction already
        // tells us the bounce direction.
        const angle = Math.atan2(collisionCorrection.y - this.y, collisionCorrection.x - this.x)
        const speed = Math.sqrt(this.pushX * this.pushX + this.pushY * this.pushY)

        this.pushX = Math.cos(angle) * speed
        this.pushY = Math.sin(angle) * speed

      } else if (
        this.shape === SHAPES.CIRCLE
        && (target.shape === SHAPES.SQUARE || target.shape === SHAPES.POLYGON)
      ) {

        // For circle + polygon collisions, we need to know...
        // - the original angle this circle was moving towards (or rather, its
        //   reverse, because we want a bounce)
        // - the normal vector (of the edge) of the polygon this circle collided
        //   into (which we can get from the collision correction)
        // - the angle between them
        const reverseOriginalAngle = Math.atan2(-this.pushY, -this.pushX)
        const normalAngle = Math.atan2(collisionCorrection.y - this.y, collisionCorrection.x - this.x)
        const angleBetween = normalAngle - reverseOriginalAngle
        const angle = reverseOriginalAngle + 2 * angleBetween

        const speed = Math.sqrt(this.pushX * this.pushX + this.pushY * this.pushY)

        this.pushX = Math.cos(angle) * speed
        this.pushY = Math.sin(angle) * speed

      } else {
        // For the moment, we're not too concerned about polygons bumping into each other
      }
    } else if (  // this object is bouncing off another movable object
      target.movable && target.solid
      && collisionCorrection.pushX !== undefined
      && collisionCorrection.pushY !== undefined
    ) {
      this.pushX = collisionCorrection.pushX
      this.pushY = collisionCorrection.pushY
    }
  }

  /*
  Section: Animation
  ----------------------------------------------------------------------------
   */

  /*
  NOTE: An Entity can support two styles of sprite sheets:
  1. 4-directional (Zelda-style) sprite sheets, which have sprites facing N, S,
     E, and W for each "action"/"state".
  2. 2-directional (Toon-style) sprite sheets, which have sprites facing SE and
     NE for each "action"/"state", which are then mirrored if the entity is
     facing W.
   */

  /*
  Get the directional orientation of the sprite, for a 4-directional
  (Zelda-style) sprite sheet.
   */
  getSpriteDirection () {
    //Favour East and West when rotation is exactly SW, NW, SE or NE.
    if (this._rotation <= Math.PI * 0.25 && this._rotation >= Math.PI * -0.25) { return DIRECTIONS.EAST }
    else if (this._rotation > Math.PI * 0.25 && this._rotation < Math.PI * 0.75) { return DIRECTIONS.SOUTH }
    else if (this._rotation < Math.PI * -0.25 && this._rotation > Math.PI * -0.75) { return DIRECTIONS.NORTH }
    else { return DIRECTIONS.WEST }
  }

  /*
  Get the directional orientation of the sprite, for a 2-directional
  (Toon-style) sprite sheet.
   */
  getSpriteDirectionEW () { return this._spriteDirectionEW }
  getSpriteDirectionNS () { return this._spriteDirectionNS }

  /*
  Get the column/row of the current sprite on the sprite sheet.
   */
  getSpriteCol () { return 0 }
  getSpriteRow () { return 0 }

  /*
  Section: Getters and Setters
  ----------------------------------------------------------------------------
   */

  get left () { return this.x - this.size / 2 }
  get right () { return this.x + this.size / 2 }
  get top () { return this.y - this.size / 2 }
  get bottom () { return this.y + this.size / 2 }

  set left (val) { this.x = val + this.size / 2 }
  set right (val) { this.x = val - this.size / 2 }
  set top (val) { this.y = val + this.size / 2 }
  set bottom (val) { this.y = val - this.size / 2 }

  get radius () { return this.size / 2 }

  set radius (val) { this.size = val * 2 }

  get col () { return Math.floor(this.x / TILE_SIZE) }
  get row () { return Math.floor(this.y / TILE_SIZE) }

  set col (val) { this.x = val * TILE_SIZE + TILE_SIZE / 2 }
  set row (val) { this.y = val * TILE_SIZE + TILE_SIZE / 2 }

  /*
  Rotation tracks the precise angle the entity is facing, in radians, clockwise
  positive. 0° (0 rad) is east/right-facing, 90° (+pi/4 rad) is
  south/down-facing.
   */
  get rotation () { return this._rotation }

  set rotation (val) {
    this._rotation = val
    while (this._rotation > Math.PI) { this._rotation -= Math.PI * 2 }
    while (this._rotation <= -Math.PI) { this._rotation += Math.PI * 2 }

    // Keep track of sprite direction for 2-directional toon-type sprites
    if (this._rotation < 0) {
      this._spriteDirectionNS = DIRECTIONS.NORTH
    } else if (this._rotation >= 0) {  // Favour south-facing
      this._spriteDirectionNS = DIRECTIONS.SOUTH
    }
    const absRotation = Math.abs(this._rotation)
    if (absRotation < Math.PI * 0.5) {
      this._spriteDirectionEW = DIRECTIONS.EAST
    } else if (absRotation > Math.PI * 0.5) {
      this._spriteDirectionEW = DIRECTIONS.WEST
    }
  }

  get vertices () {
    const v = []
    if (this.shape === SHAPES.SQUARE) {
      v.push({ x: this.left, y: this.top })
      v.push({ x: this.right, y: this.top })
      v.push({ x: this.right, y: this.bottom })
      v.push({ x: this.left, y: this.bottom })
    } else if (this.shape === SHAPES.CIRCLE) {  //Approximation
      CIRCLE_TO_POLYGON_APPROXIMATOR.map((approximator) => {
        v.push({ x: this.x + this.radius * approximator.cosAngle, y: this.y + this.radius * approximator.sinAngle })
      })
    } else if (this.shape === SHAPES.POLYGON) {
      if (!this.shapePolygonPath) return []
      for (let i = 0 ; i < this.shapePolygonPath.length ; i += 2) {
        v.push({ x: this.x + this.shapePolygonPath[i], y: this.y + this.shapePolygonPath[i+1] })
      }
    }
    return v
  }

  set vertices (val) { console.error('ERROR: Entity.vertices is read only') }

  get solid () { return this._solid }
  get movable () { return this._movable }
  get mass () {  return this._mass }
  get moveAcceleration () { return this._moveAcceleration }
  get moveDeceleration () { return this._moveDeceleration }
  get moveMaxSpeed () { return this._moveMaxSpeed }
  get pushDeceleration () { return this._pushDeceleration }
  get pushMaxSpeed () { return this._pushMaxSpeed }

  set solid (val) { this._solid = val }
  set movable (val) { this._movable = val }
  set mass (val) {  this._mass = val }
  set moveAcceleration (val) { this._moveAcceleration = val }
  set moveDeceleration (val) { this._moveDeceleration = val }
  set moveMaxSpeed (val) { this._moveMaxSpeed = val }
  set pushDeceleration (val) { this._pushDeceleration = val }
  set pushMaxSpeed (val) { this._pushMaxSpeed = val }

  get moveSpeed () { return Math.sqrt(this.moveX * this.moveX + this.moveY * this.moveY) }
  get moveAngle () { return Math.atan2(this.moveY, this.moveX) }
  get pushSpeed () { return Math.sqrt(this.pushX * this.pushX + this.pushY * this.pushY) }
  get pushAngle () { return Math.atan2(this.pushY, this.pushX) }

  set moveSpeed (val) { console.error('ERROR: Entity.moveSpeed is read only') }
  set moveAngle (val) { console.error('ERROR: Entity.moveAngle is read only') }
  set pushSpeed (val) { console.error('ERROR: Entity.pushSpeed is read only') }
  set pushAngle (val) { console.error('ERROR: Entity.pushAngle is read only') }
}

const CIRCLE_TO_POLYGON_APPROXIMATOR =
  [ROTATIONS.EAST, ROTATIONS.SOUTHEAST, ROTATIONS.SOUTH, ROTATIONS.SOUTHWEST,
   ROTATIONS.WEST, ROTATIONS.NORTHWEST, ROTATIONS.NORTH, ROTATIONS.NORTHEAST]
  .map((angle) => {
    return ({ cosAngle: Math.cos(angle), sinAngle: Math.sin(angle) })
  })
