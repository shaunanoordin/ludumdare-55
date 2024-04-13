import Entity from '@avo/entity'
import { TILE_SIZE, EXPECTED_TIMESTEP } from '@avo/constants'

export default class Shot extends Entity {
  constructor (app, x = 0, y = 0, rotation = 0, source = undefined) {
    super(app)
    this._type = 'shot'

    this.source = source  // The entity that this shot came from

    this.colour = '#cc4'
    this.solid = false
    this.movable = true

    this.size = TILE_SIZE / 2
    this.x = x
    this.y = y

    this.rotation = rotation
    this.moveAcceleration = 1
    this.moveDeceleration = 0
    this.moveMaxSpeed = this.size * 2
    this.distance = this.size * 1
  }

  onCollision (target, collisionCorrection) {
    super.onCollision(target, collisionCorrection)
    if (this.source !== target && target.solid) {
      target.applyEffect({
        name: 'damage',
      }, this)
      this._expired = true
    }
  }

  play (timeStep) {
    super.play(timeStep)
    const app = this._app

    const moveAcceleration = this.moveAcceleration * timeStep / EXPECTED_TIMESTEP || 0
    this.moveX += moveAcceleration * Math.cos(this.rotation)
    this.moveY += moveAcceleration * Math.sin(this.rotation)

    this.distance -= moveAcceleration
    if (this.distance <= 0) this._expired = true
  }
}
