export default class ImageAsset {
  constructor (url) {
    this.url = url
    this.ready = false
    this.error = false
    
    this.img = new Image()
    this.img.onload = function () {
      this.ready = true
      this.error = false
    }.bind(this)
    this.img.onerror = function (err) {
      console.error('ImageAsset Error ('+this.url+'): ', err)
      this.ready = false
      this.error = true
    }.bind(this)
    
    this.img.src = this.url
  }
}
