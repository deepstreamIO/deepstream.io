'use strict'
/* eslint-disable class-methods-use-this */

const StateRegistry = require('./state-registry')

class ClusterNode {
  constructor () {
    this._stateRegistries = {}
  }

  sendDirect () {}

  sendState () {}

  send () {}

  subscribe () {}

  isLeader () { throw new Error('Leader not used in single state') }

  getStateRegistry (name) {
    if (this._stateRegistries[name]) {
      return this._stateRegistries[name]
    }
    this._stateRegistries[name] = new StateRegistry()

    return this._stateRegistries[name]
  }

  close (callback) {
    callback()
  }
}

module.exports = ClusterNode
