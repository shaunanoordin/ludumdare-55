import Entity from '@avo/entity'
import { TILE_SIZE, SHAPES, LAYERS } from '@avo/constants'

export default class Tile extends Entity {
  constructor (app, col = 0, row = 0) {
    super(app)
    this._type = 'tile'

    this.colour = '#e0e0e0'
    this.solid = false
    this.movable = false

    this.x = col * TILE_SIZE + TILE_SIZE / 2
    this.y = row * TILE_SIZE + TILE_SIZE / 2
    this.size = TILE_SIZE
    this.shape = SHAPES.SQUARE
  }

  paint (layer) {
    const c2d = this._app.canvas2d
    this._app.applyCameraTransforms()

    if (layer === LAYERS.BACKGROUND) {
      c2d.fillStyle = this.colour
      c2d.beginPath()
      c2d.rect(Math.floor(this.x - this.size / 2), Math.floor(this.y - this.size / 2), this.size, this.size)
      c2d.fill()
    }

    this._app.undoCameraTransforms()
  }
}
