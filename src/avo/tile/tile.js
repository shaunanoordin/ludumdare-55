import { TILE_SIZE, SHAPES, LAYERS } from '@avo/constants'

export default class Tile {
  constructor (app, col = 0, row = 0) {
    this._app = app
    this._type = 'tile'

    this.colour = '#f0f0f0'
    this.solid = false
    this.movable = false

    this.col = col
    this.row = row
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

  get col () { return Math.floor(this.x / TILE_SIZE) }
  get row () { return Math.floor(this.y / TILE_SIZE) }

  set col (val) { this.x = val * TILE_SIZE + TILE_SIZE / 2 }
  set row (val) { this.y = val * TILE_SIZE + TILE_SIZE / 2 }
}
