/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const EventEmitter = require('events').EventEmitter

module.exports = class LocalMessageConnector {
  constructor() {
    this._emitter = new EventEmitter()
    this.messages = []
    this.subscribedTopics = []
    this.dropNextMessage = false
    this.lastMessage = null
  }

  subscribe(topic, callback) {
    this.subscribedTopics.push(topic)
    this._emitter.on(topic, callback)
  }

  unsubscribe(topic, callback) {
    this._emitter.removeListener(topic, callback)
  }

  publish(topic, data) {
    if (this.dropNextMessage === true) {
      this.dropNextMessage = false
      return
    }
    this.lastMessage = {
      topic,
      data
    }
    this.messages.push(this.lastMessage)
    this._emitter.emit(topic, data)
  }
}
