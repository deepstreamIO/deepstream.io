'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

const clients = clientHandler.clients

module.exports = {
  setupListenResponse (client, accepts, type, subscriptionName, pattern) {
    clients[client][type].callbacksListenersSpies[pattern].withArgs(subscriptionName, true)
    clients[client][type].callbacksListenersSpies[pattern].withArgs(subscriptionName, false)
    clients[client][type].callbacksListenersResponse[pattern] = accepts
  },

  listens (client, type, pattern) {
    if (!clients[client][type].callbacksListenersSpies[pattern]) {
      clients[client][type].callbacksListenersSpies[pattern] = sinon.spy()
    }

    clients[client][type].callbacksListeners[pattern] = (subscriptionName, isSubscribed, response) => {
      if (isSubscribed) {
        if (clients[client][type].callbacksListenersResponse[pattern]) {
          response.accept()
        } else {
          response.reject()
        }
      }
      clients[client][type].callbacksListenersSpies[pattern](subscriptionName, isSubscribed)
    }
    clients[client].client[type].listen(pattern, clients[client][type].callbacksListeners[pattern])
  },

  unlistens (client, type, pattern) {
    clients[client].client[type].unlisten(pattern)
    clients[client][type].callbacksListeners[pattern].isListening = false
  }
}

module.exports.assert = {
  doesNotRecieveMatch (client, type, match, pattern) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern]
    sinon.assert.neverCalledWith(listenCallbackSpy, match)
  },

  recievesMatch (client, count, type, subscriptionName, pattern) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern]
    sinon.assert.callCount(listenCallbackSpy.withArgs(subscriptionName, true), Number(count))
  },

  recievedUnMatch (client, count, type, subscriptionName, pattern) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern]
    sinon.assert.callCount(listenCallbackSpy.withArgs(subscriptionName, false), Number(count))
  }
}
