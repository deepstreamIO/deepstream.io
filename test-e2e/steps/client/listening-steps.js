'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

const clients = clientHandler.clients

module.exports = function () {

  this.When(/^publisher (\S*) (accepts|rejects) (?:a|an) (event|record) match "([^"]*)" for pattern "([^"]*)"$/, (client, action, type, subscriptionName, pattern) => {
    clients[client][type].callbacksListenersSpies[pattern].withArgs(subscriptionName, true)
    clients[client][type].callbacksListenersSpies[pattern].withArgs(subscriptionName, false)
    clients[client][type].callbacksListenersResponse[pattern] = (action === 'accepts')
  })

  this.When(/^publisher (\S*) listens to (?:a|an) (event|record) with pattern "([^"]*)"$/, (client, type, pattern, done) => {
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
    setTimeout(done, utils.defaultDelay)
  })

  this.When(/^publisher (\S*) unlistens to the (event|record) pattern "([^"]*)"$/, (client, type, pattern, done) => {
    clients[client].client[type].unlisten(pattern)
    clients[client][type].callbacksListeners[pattern].isListening = false
    setTimeout(done, utils.defaultDelay)
  })

  this.Then(/^publisher (\S*) does not receive (?:a|an) (event|record) match "([^"]*)" for pattern "([^"]*)"$/, (client, type, match, pattern) => {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern]
    sinon.assert.neverCalledWith(listenCallbackSpy, match)
  })

  this.Then(/^publisher (\S*) receives (\d+) (event|record) (?:match|matches) "([^"]*)" for pattern "([^"]*)"$/, (client, count, type, subscriptionName, pattern) => {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern]
    sinon.assert.callCount(listenCallbackSpy.withArgs(subscriptionName, true), Number(count))
  })

  this.Then(/^publisher (\S*) removed (\d+) (event|record) (?:match|matches) "([^"]*)" for pattern "([^"]*)"$/, (client, count, type, subscriptionName, pattern) => {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern]
    sinon.assert.callCount(listenCallbackSpy.withArgs(subscriptionName, false), Number(count))
  })

}
