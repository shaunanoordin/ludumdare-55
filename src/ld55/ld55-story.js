import Story from '@avo/story'
import ImageAsset from '@avo/image-asset'
import { ROTATIONS } from '@avo/constants'

import Hero from './entities/hero'
import Wizard from './entities/wizard'
import Wall from '@avo/entity/types/wall'

import PlayerControls from './rules/player-controls'

export default class LD55Story extends Story {
  constructor (app) {
    super(app)
  }

  get assets () {
    return {
      "hero": new ImageAsset('assets/avo-sprites-2022-05-samiel.png'),
    }
  }

  start () {
    super.start()
    this.load_first_scene()
  }

  load_first_scene () {
    const app = this._app

    app.hero = app.addEntity(new Hero(app, 11, 20))
    app.hero.rotation = ROTATIONS.NORTH
    app.camera.target = app.hero

    app.addRule(new PlayerControls(app))

    app.addEntity(new Wall(app, 0, 0, 1, 23))  // West Wall
    app.addEntity(new Wall(app, 22, 0, 1, 23))  // East Wall
    app.addEntity(new Wall(app, 1, 0, 21, 1))  // North Wall
    app.addEntity(new Wall(app, 1, 22, 21, 1))  // South Wall

    app.addEntity(new Wizard(app, 11, 4))
  }
}
