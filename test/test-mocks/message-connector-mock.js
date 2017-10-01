/* eslint-disable class-methods-use-this */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const EventEmitter = require('events').EventEmitter
const StateRegistry = require('../../src/cluster/state-registry')

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

  send (topic, message) {
    if (typeof topic !== 'string') {
      throw new Error('No topic provided')
    }
    this.publishedMessages.push(message)
    this.lastPublishedTopic = topic
    this.lastPublishedMessage = JSON.parse(JSON.stringify(message))
  }

  sendState (topic, message) { // eslint-disable-line

  }

  sendDirect (serverName, topic, message) {
    this.lastDirectSentMessage = {
      serverName,
      topic,
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
