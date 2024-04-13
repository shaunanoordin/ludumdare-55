import Rule from '@avo/rule'
import { EXPECTED_TIMESTEP } from '@avo/constants'

export default class CNY2022Controls extends Rule {
  constructor (app) {
    super(app)
    this._type = 'cny2022-controls'
  }

  play (timeStep) {
    const app = this._app
    super.play(timeStep)

    const pointer = app.playerInput.pointerCurrent
    const hero = app.hero

    if (hero && pointer) {
      const camera = app.camera
      const target = {
        x: pointer.x - camera.x,
        y: pointer.y - camera.y,
      }

      const distX = target.x - app.hero.x
      const distY = target.y - app.hero.y
      const angleToTarget = Math.atan2(distY, distX)
      const ACCELERATION = 1

      hero.rotation = angleToTarget
      hero.pushX += ACCELERATION * Math.cos(angleToTarget)
      hero.pushY += ACCELERATION * Math.sin(angleToTarget)
    }
  }

  paint (layer = 0) {
    const c2d = this._app.canvas2d
    const camera = this._app.camera
    const pointer = this._app.playerInput.pointerCurrent

    if (layer === LAYERS.HUD && pointer) {
      const crosshairX = pointer.x
      const crosshairY = pointer.y
      const crosshairSize = 16
      const crosshairLeft = crosshairX - crosshairSize
      const crosshairRight = crosshairX + crosshairSize
      const crosshairTop = crosshairY - crosshairSize
      const crosshairBottom = crosshairY + crosshairSize

      // Draw crosshair at mouse cursor
      c2d.beginPath()
      c2d.moveTo(crosshairLeft, crosshairY)
      c2d.lineTo(crosshairRight, crosshairY)
      c2d.moveTo(crosshairX, crosshairTop)
      c2d.lineTo(crosshairX, crosshairBottom)
      c2d.strokeStyle = '#c88'
      c2d.lineWidth = 3
      c2d.stroke()
    }
  }
}
