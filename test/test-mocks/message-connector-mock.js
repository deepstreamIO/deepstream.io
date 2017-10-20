'use strict'

const EventEmitter = require('events').EventEmitter
const StateRegistry = require('../../src/cluster/state-registry').default

module.exports = class MessageConnectorMock extends EventEmitter {

  constructor (options) {
    super()
    this.lastPublishedTopic = null
    this.lastPublishedMessage = null
    this.lastSubscribedTopic = null
    this.publishedMessages = []
    this._eventEmitter = new EventEmitter()
    this._eventEmitter.setMaxListeners(0)
    this.all = null
    this.currentLeader = null
    this.options = options
  }

  reset () {
    this.publishedMessages = []
    this.lastPublishedTopic = null
    this.lastPublishedMessage = null
    this.lastSubscribedTopic = null

    this.all = ['server-name-a', 'server-name-b', 'server-name-c']
    this.currentLeader = 'server-name-a'
  }

  subscribe (topic, callback) {
    this.lastSubscribedTopic = topic
    this._eventEmitter.on(topic, callback)
  }

  sendBroadcast () {

  }

  send (message) {
    this.publishedMessages.push(message)
    this.lastPublishedTopic = message.topic
    this.lastPublishedMessage = JSON.parse(JSON.stringify(message))
  }

  sendState (topic, message) { // eslint-disable-line

  }

  sendDirect (serverName, message) {
    this.lastDirectSentMessage = {
      serverName,
      message
    }
  }

  unsubscribe (topic, callback) {
    this._eventEmitter.removeListener(topic, callback)
  }

  simulateIncomingMessage (topic, msg, serverName) {
    this._eventEmitter.emit(topic, msg, serverName)
  }

  getAll () {
    return this.all
  }

  isLeader () {
    return this.currentLeader === this.options.serverName
  }

  getCurrentLeader () {
    return this.currentLeader
  }

  subscribeServerDisconnect () {

  }

  getStateRegistry (topic) {
    return new StateRegistry(topic, this.options, this)
  }

}
