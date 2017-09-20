/* eslint-disable */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'
const C = require('../../src/constants/constants')
module.exports = class LoggerMock {
	constructor () {
	  this.isReady = true
	  this.lastLogLevel = null
	  this.lastLogEvent = null
	  this.lastLogMessage = null
	  this.lastLogArguments = null

	  this.log = jasmine.createSpy('log')
	}

	warn (event, message) {
	  this.log(C.LOG_LEVEL.WARN, event, message)
	  this._log(C.LOG_LEVEL.WARN, event, message)
	}

	debug (event, message) {
	  this.log(C.LOG_LEVEL.DEBUG, event, message)
	  this._log(C.LOG_LEVEL.DEBUG, event, message)
	}

	info (event, message) {
	  this.log(C.LOG_LEVEL.INFO, event, message)
	  this._log(C.LOG_LEVEL.INFO, event, message)
	}

	error (event, message) {
	  this.log(C.LOG_LEVEL.ERROR, event, message)
	  this._log(C.LOG_LEVEL.ERROR, event, message)
	}

	_log (level, event, message) {
	  this.lastLogLevel = level
	  this.lastLogEvent = event
	  this.lastLogMessage = message
	  this.lastLogArguments = Array.from(arguments)
	}

	setLogLevel () {
	}
}
