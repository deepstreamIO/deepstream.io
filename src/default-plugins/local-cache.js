'use strict'

class LocalCache {
  constructor () {
    this.isReady = true
    this._data = {}
    this.type = 'local cache'
  }

  set (key, value, callback) {
    this._data[key] = value
    callback(null)
  }

  get (key, callback) {
    callback(null, this._data[key] || null)
  }

  delete (key, callback) {
    delete this._data[key]
    callback(null)
  }
}

module.exports = new LocalCache()
