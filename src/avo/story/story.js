export default class Story {
  constructor (app) {
    this._app = app
  }

  get assets () {
    return {}
  }

  /*
  Section: Main Scripts
  ----------------------------------------------------------------------------
   */

  start () {
    this.reset()
  }

  reset () {
    const app = this._app
    app.hero = undefined
    app.entities = []
    app.clearRules()
    app.camera.target = null
    app.camera.x = 0
    app.camera.y = 0
    app.camera.zoom = 1
    app.resetPlayerInput()
    app.setInteractionMenu(false)
  }

  reload () {
    this.start()
  }
}
