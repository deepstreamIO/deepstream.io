/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const EventEmitter = require('events').EventEmitter

module.exports = class ClusterRegistryMock extends EventEmitter {
  constructor(options) {
    super()
    this.all = null
    this.currentLeader = null
    this.options = options
    this.reset()
  }

  reset() {
    this.all = ['server-name-a', 'server-name-b', 'server-name-c']
    this.currentLeader = 'server-name-a'
  }

  getAll() {
    return this.all
  }

  isLeader() {
    return this.currentLeader === this.options.serverName
  }

  getCurrentLeader() {
    return this.currentLeader
  }
}
