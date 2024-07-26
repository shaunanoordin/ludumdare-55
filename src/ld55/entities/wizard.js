import Entity from '@avo/entity'
import { TILE_SIZE } from '@avo/constants'

export default class Hero extends Entity {
  constructor (app, col = 0, row = 0) {
    super(app)
    this._type = 'wizard'

    this.colour = '#000'
    this.size = TILE_SIZE * 2
    this.x = col * TILE_SIZE + TILE_SIZE / 2
    this.y = row * TILE_SIZE + TILE_SIZE / 2
  }

  /*
  Section: General Logic
  ----------------------------------------------------------------------------
   */

  play (timeStep) {
    super.play(timeStep)

    this.processIntent()
    this.processAction(timeStep)
    this.doMaxSpeedLimit()
  }

  paint (layer = 0) {
    super.paint(layer)
  }

  /*
  Section: Game Logic
  ----------------------------------------------------------------------------
   */

  applyEffect (effect, source) {
    super.applyEffect(effect, source)
    if (!effect) return

    if (effect.name === 'damage') {
      // TODO
    }
  }

  /*
  Section: Intent and Actions
  ----------------------------------------------------------------------------
   */

  /*
  Translate intent into action.
   */
  processIntent () {}

  /*
  Perform the action.
   */
  processAction (timeStep) {}

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
}
