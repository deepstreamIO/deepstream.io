/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

module.exports = class PermissionHander {
	constructor () {
	  this.options = options
	  this.isReady = true
	}

	canPerformAction (username, message, callback, socketWrapper) {
  		callback(null, true)
	}
}
