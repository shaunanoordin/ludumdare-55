import Tile from '@avo/tile'

export default class WallTile extends Tile {
  constructor (app, col = 0, row = 0) {
    super(app, col, row)
    this._type = 'wall-tile'

    this.colour = '#808080'
    this.solid = true
  }
}
