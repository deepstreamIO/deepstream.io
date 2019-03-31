import * as sinon from 'sinon'
import { clientHandler } from './client-handler'

const subscribeEvent = 'subscribe'
const queryEvent = 'query'

export const assert = {
  notifiedUserStateChanged (notifeeExpression, not, notiferExpression, event) {
    clientHandler.getClients(notifeeExpression).forEach(notifee => {
      clientHandler.getClients(notiferExpression).forEach(notifier => {
        if (not) {
          sinon.assert.neverCalledWith(notifee.presence.callbacks[subscribeEvent], notifier.user, event === 'in')
        } else {
          sinon.assert.calledWith(notifee.presence.callbacks[subscribeEvent], notifier.user, event === 'in')
        }
      })
      notifee.presence.callbacks[subscribeEvent]. resetHistory()
    })
  },

  globalQueryResult (clientExpression, error, users?) {
    clientHandler.getClients(clientExpression).forEach(client => {
      sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
      if (users) {
        sinon.assert.calledWith(client.presence.callbacks[queryEvent], error, users)
      } else {
        sinon.assert.calledWith(client.presence.callbacks[queryEvent], error)
      }
      client.presence.callbacks[queryEvent]. resetHistory()
    })
  },

  queryResult (clientExpression, users, online) {
    clientHandler.getClients(clientExpression).forEach(client => {
      const result = {}
      for (let i = 0; i < users.length; i++) {
        result[users[i]] = online
      }
      sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
      sinon.assert.calledWith(client.presence.callbacks[queryEvent], null, result)
      client.presence.callbacks[queryEvent]. resetHistory()
    })
  }
}

export const presence = {
  assert,
  subscribe (clientExpression, user?) {
    clientHandler.getClients(clientExpression).forEach(client => {
      if (!client.presence.callbacks[subscribeEvent]) {
        client.presence.callbacks[subscribeEvent] = sinon.spy()
      }
      if (user) {
        client.client.presence.subscribe(user, client.presence.callbacks[subscribeEvent])
      } else {
        client.client.presence.subscribe(client.presence.callbacks[subscribeEvent])
      }
    })
  },

  unsubscribe (clientExpression, user?) {
    clientHandler.getClients(clientExpression).forEach(client => {
      if (user) {
        client.client.presence.unsubscribe(user)
      } else {
        client.client.presence.unsubscribe()
      }
    })
  },

  getAll (clientExpression, users?) {
    clientHandler.getClients(clientExpression).forEach(client => {
      client.presence.callbacks[queryEvent] = sinon.spy()
      if (users) {
        client.client.presence.getAll(users, client.presence.callbacks[queryEvent])
      } else {
        client.client.presence.getAll(client.presence.callbacks[queryEvent])
      }
    })
  }
}
