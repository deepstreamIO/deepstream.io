/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const EventEmitter = require('events').EventEmitter

const MessageConnectorMock = function () {
  this.lastPublishedTopic = null
  this.lastPublishedMessage = null
  this.lastSubscribedTopic = null
  this.publishedMessages = []
  this._eventEmitter = new EventEmitter()
}

MessageConnectorMock.prototype.reset = function () {
  this.publishedMessages = []
  this.lastPublishedTopic = null
  this.lastPublishedMessage = null
  this.lastSubscribedTopic = null
}

MessageConnectorMock.prototype.subscribe = function (topic, callback) {
  this.lastSubscribedTopic = topic
  this._eventEmitter.on(topic, callback)
}

MessageConnectorMock.prototype.publish = function (topic, message) {
  if (typeof topic !== 'string') {
    throw new Error('No topic provided')
  }
  this.publishedMessages.push(message)
  this.lastPublishedTopic = topic
  this.lastPublishedMessage = JSON.parse(JSON.stringify(message))
}

MessageConnectorMock.prototype.unsubscribe = function (topic, callback) {
  this._eventEmitter.removeListener(topic, callback)
}

MessageConnectorMock.prototype.simulateIncomingMessage = function (msg) {
  this._eventEmitter.emit(msg.topic, msg)
}

module.exports = MessageConnectorMock
