'use strict'

module.exports = class PermissionHander {
  constructor (options) {
    this.options = options
    this.isReady = true
  }

  canPerformAction (username, message, callback /* , socketWrapper */) {
    callback(null, true)
  }
}
