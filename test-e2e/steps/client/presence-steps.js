'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

const clients = clientHandler.clients
const { When, Then, Given } = require('cucumber')


const subscribeEvent = 'subscribe'
const queryEvent = 'query'

Given(/^(.+) subscribes to presence events$/, (clientExpression, done) => {
  clientHandler.getClients(clientExpression).forEach((client) => {
    client.presence.callbacks[subscribeEvent] = sinon.spy()
    client.client.presence.subscribe(client.presence.callbacks[subscribeEvent])
  })
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) queries for connected clients$/, (clientExpression, done) => {
  clientHandler.getClients(clientExpression).forEach((client) => {
    client.presence.callbacks[queryEvent] = sinon.spy()
    client.client.presence.getAll(client.presence.callbacks[queryEvent])
  })
  setTimeout(done, utils.defaultDelay)
})

Then(/^(.+) (?:is|are) notified that (.+) logged ([^"]*)$/, (notifeeExpression, notiferExpression, event) => {
  clientHandler.getClients(notifeeExpression).forEach((notifee) => {
    clientHandler.getClients(notiferExpression).forEach((notifier) => {
      sinon.assert.calledWith(notifee.presence.callbacks[subscribeEvent], notifier.user, event === 'in')
    })
    notifee.presence.callbacks[subscribeEvent].reset()
  })
})

Then(/^(.+) is notified that (?:clients|client) "([^"]*)" (?:are|is) connected$/, (clientExpression, connectedClients) => {
  clientHandler.getClients(clientExpression).forEach((client) => {
    sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
    sinon.assert.calledWith(client.presence.callbacks[queryEvent], connectedClients.split(','))
    client.presence.callbacks[queryEvent].reset()
  })
})

Then(/^(.+) is notified that no clients are connected$/, (clientExpression) => {
  clientHandler.getClients(clientExpression).forEach((client) => {
    sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
    sinon.assert.calledWith(client.presence.callbacks[queryEvent], [])
    client.presence.callbacks[queryEvent].reset()
  })
})

