'use strict'

const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

const subscribeEvent = 'subscribe'
const queryEvent = 'query'

module.exports = {
  subscribe (clientExpression, user) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.presence.callbacks[subscribeEvent] = sinon.spy()
      if (user) {
        client.client.presence.subscribe(user, client.presence.callbacks[subscribeEvent])
      } else {
        client.client.presence.subscribe(client.presence.callbacks[subscribeEvent])
      }
    })
  },

  getAll (clientExpression, users) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.presence.callbacks[queryEvent] = sinon.spy()
      if (users) {
        client.client.presence.getAll(users, client.presence.callbacks[queryEvent])
      } else {
        client.client.presence.getAll(client.presence.callbacks[queryEvent])
      }
    })
  }
}

module.exports.assert = {
  notifiedUserStateChanged (notifeeExpression, notiferExpression, event) {
    clientHandler.getClients(notifeeExpression).forEach((notifee) => {
      clientHandler.getClients(notiferExpression).forEach((notifier) => {
        try {
          sinon.assert.calledWith(notifee.presence.callbacks[subscribeEvent], notifier.user, event === 'in')
        } catch (e) {
          sinon.assert.calledWith(notifee.presence.callbacks[subscribeEvent], event === 'in', notifier.user)
        }
      })
      notifee.presence.callbacks[subscribeEvent].reset()
    })
  },

  globalQueryResult (clientExpression, users) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
      sinon.assert.calledWith(client.presence.callbacks[queryEvent], users)
      client.presence.callbacks[queryEvent].reset()
    })
  },

  queryResult (clientExpression, users, online) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const result = {}
      for (let i = 0; i < users.length; i++) {
        result[users[i]] = online
      }
      sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
      sinon.assert.calledWith(client.presence.callbacks[queryEvent], result)
      client.presence.callbacks[queryEvent].reset()
    })
  }
}
