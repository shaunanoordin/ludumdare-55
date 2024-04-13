import Entity from '@avo/entity'
import { TILE_SIZE } from '@avo/constants'

export default class Ball extends Entity {
  constructor (app, col = 0, row = 0) {
    super(app)
    this._type = 'ball'

    this.colour = '#48c'
    this.solid = true
    this.movable = true
    this.x = col * TILE_SIZE + TILE_SIZE / 2
    this.y = row * TILE_SIZE + TILE_SIZE / 2
  }
}
