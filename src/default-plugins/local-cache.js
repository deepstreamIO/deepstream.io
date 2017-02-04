const LocalCache = function () {
  this.isReady = true
}

LocalCache.prototype.set = function (key, value, callback) {
  callback(null, key)
}

LocalCache.prototype.get = function (key, callback) {
  callback(null, key, null)
}

LocalCache.prototype.delete = function (key, callback) {
  callback(null, key)
}

module.exports = new LocalCache()
