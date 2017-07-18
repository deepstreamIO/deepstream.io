'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

module.exports = function () {

  this.When(/^(.+) publishes? (?:an|the) event "([^"]*)"(?: with data ("[^"]*"|\d+|\{.*\}))?$/, (clientExpression, subscriptionName, data, done) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.event.emit(subscriptionName, utils.parseData(data))
    })
    setTimeout(done, utils.defaultDelay)
  })

  this.Then(/^(.+) receives? (the|no) event "([^"]*)"(?: with data (.+))?$/, (clientExpression, theNo, subscriptionName, data) => {
    const doesReceive = !theNo.match(/^no$/)

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
  })

  this.Given(/^(.+) subscribes? to (?:an|the) event "([^"]*)"$/, (clientExpression, subscriptionName, done) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.event.callbacks[subscriptionName] = sinon.spy()
      client.client.event.subscribe(subscriptionName, client.event.callbacks[subscriptionName])
    })
    setTimeout(done, utils.defaultDelay)
  })

  this.When(/^(.+) unsubscribes from (?:an|the) event "([^"]*)"$/, (clientExpression, subscriptionName, done) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.event.unsubscribe(subscriptionName, client.event.callbacks[subscriptionName])
      client.event.callbacks[subscriptionName].isSubscribed = false
    })
    setTimeout(done, utils.defaultDelay)
  })

}
