'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

const subscribeEvent = 'subscribe'
const queryEvent = 'query'

module.exports = {
  subscribe (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.presence.callbacks[subscribeEvent] = sinon.spy()
      client.client.presence.subscribe(client.presence.callbacks[subscribeEvent])
    })
  },

  getAll (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.presence.callbacks[queryEvent] = sinon.spy()
      client.client.presence.getAll(client.presence.callbacks[queryEvent])
    })
  }
}

module.exports.assert = {
  notifiedUserStateChanged (notifeeExpression, notiferExpression, event) {
    clientHandler.getClients(notifeeExpression).forEach((notifee) => {
      clientHandler.getClients(notiferExpression).forEach((notifier) => {
        sinon.assert.calledWith(notifee.presence.callbacks[subscribeEvent], notifier.user, event === 'in')
      })
      notifee.presence.callbacks[subscribeEvent].reset()
    })
  },

  queryResult (clientExpression, users) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
      sinon.assert.calledWith(client.presence.callbacks[queryEvent], users)
      client.presence.callbacks[queryEvent].reset()
    })
  }
}
