'use strict'

exports.get = function (key, callback) {
  callback(null, null)
}

exports.type = 'no storage connector specified'
exports.set = function (key, value, callback) { callback(null) }
exports.delete = function (key, callback) { callback(null) }
exports.isReady = true
