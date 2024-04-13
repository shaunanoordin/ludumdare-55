export default class JsonAsset {
  constructor (url) {
    this.url = url
    this.ready = false
    this.error = false
    
    this.data = null
    
    fetch(this.url)
    .then(function (response) {
      if (!response || !response.ok) throw new Error('Invalid response')
      return response.json()
    }.bind(this))
    .then(function (data) {
      if (!data) throw new Error('Invalid response')
      this.data = data
      this.ready = true
      this.error = false
    }.bind(this))
    .catch(function (err) {
      console.error('JsonAsset Error ('+this.url+'): ', err)
      this.data = null
      this.ready = false
      this.error = true
      
    }.bind(this))
  }
}
