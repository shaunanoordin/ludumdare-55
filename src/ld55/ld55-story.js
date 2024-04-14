import { POINTER_STATES } from '@avo/constants'

import Story from '@avo/story'
import ImageAsset from '@avo/image-asset'

import Hero from '@avo/entity/types/hero'
import Wall from '@avo/entity/types/wall'
import Ball from '@avo/entity/types/ball'
import Enemy from '@avo/entity/types/enemy'

import ZeldaControls from '@avo/rule/types/zelda-controls'

export default class LD55Story extends Story {
  constructor (app) {
    super(app)
  }

  get assets () {
    return {
      "hero-4dir": new ImageAsset('assets/avo-sprites-2022-05-samiel.png'),
      "hero-2dir": new ImageAsset('assets/avo-sprites-2022-10-samiel-2dir.png'),
    }
  }

  start () {
    super.start()
    this.load_first_scene()
  }

  load_first_scene () {
    const app = this._app

    app.hero = app.addEntity(new Hero(app, 11, 1))
    app.camera.target = app.hero

    app.addRule(new ZeldaControls(app))

    app.addEntity(new Wall(app, 0, 0, 1, 23))  // West Wall
    app.addEntity(new Wall(app, 22, 0, 1, 23))  // East Wall
    app.addEntity(new Wall(app, 1, 0, 21, 1))  // North Wall
    app.addEntity(new Wall(app, 1, 22, 21, 1))  // South Wall

    const enemy = app.addEntity(new Enemy(app, 4, 8))
    enemy.rotation = -45 / 180 * Math.PI
  }
}
