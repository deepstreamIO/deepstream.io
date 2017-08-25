'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

module.exports = {
  publishes (clientExpression, subscriptionName, data, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.event.emit(subscriptionName, utils.parseData(data))
    })
  },

  recieved (clientExpression, doesReceive, subscriptionName, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const eventSpy = client.event.callbacks[subscriptionName]
      if (doesReceive) {
        sinon.assert.calledOnce(eventSpy)
        sinon.assert.calledWith(eventSpy, utils.parseData(data))
        eventSpy.reset()
      } else {
        sinon.assert.notCalled(eventSpy)
      }
    })
  },

  subscribes (clientExpression, subscriptionName, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.event.callbacks[subscriptionName] = sinon.spy()
      client.client.event.subscribe(subscriptionName, client.event.callbacks[subscriptionName])
    })
  },

  unsubscribes (clientExpression, subscriptionName, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.event.unsubscribe(subscriptionName, client.event.callbacks[subscriptionName])
      client.event.callbacks[subscriptionName].isSubscribed = false
    })
  }
}
