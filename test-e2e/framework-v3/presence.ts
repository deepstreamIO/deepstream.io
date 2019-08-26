import * as sinon from 'sinon'
import { clientHandler } from './client-handler'
import { client as cl } from './client'
import { Dictionary } from 'ts-essentials'

const subscribeEvent = 'subscribe'
const queryEvent = 'query'

export const assert = {
  notifiedUserStateChanged (notifeeExpression: string, not: boolean, notiferExpression: string, event: string) {
    clientHandler.getClients(notifeeExpression).forEach((notifee) => {
      clientHandler.getClients(notiferExpression).forEach((notifier) => {
        if (not) {
          sinon.assert.neverCalledWith(notifee.presence.callbacks[subscribeEvent], notifier.user, event === 'in')
        } else {
          sinon.assert.calledWith(notifee.presence.callbacks[subscribeEvent], notifier.user, event === 'in')
        }
      })
      notifee.presence.callbacks[subscribeEvent].resetHistory()
    })
  },

  globalQueryResult (clientExpression: string, error: null | string, users?: string[]) {
    if (error) {
      cl.recievedOneError(clientExpression, 'PRESENCE', error)
      return
    }
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
      if (users) {
        sinon.assert.calledWith(client.presence.callbacks[queryEvent], users)
      } else {
        sinon.assert.calledWith(client.presence.callbacks[queryEvent])
      }
      client.presence.callbacks[queryEvent].resetHistory()
    })
  },

  queryResult (clientExpression: string, users: string[], online: boolean) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const result = users.reduce((r, user) => {
        r[user] = online
        return r
      }, {} as Dictionary<boolean>)
      sinon.assert.calledOnce(client.presence.callbacks[queryEvent])
      sinon.assert.calledWith(client.presence.callbacks[queryEvent], result)
      client.presence.callbacks[queryEvent].resetHistory()
    })
  }
}

export const presence = {
  assert,
  subscribe (clientExpression: string, user?: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      if (!client.presence.callbacks[subscribeEvent]) {
        client.presence.callbacks[subscribeEvent] = sinon.spy()
      }
      if (user) {
        client.client.presence.subscribe(user, (...args: any[]) => {
          client.presence.callbacks[subscribeEvent](args[1], args[0])
        })
      } else {
        client.client.presence.subscribe((...args: any[]) => {
          client.presence.callbacks[subscribeEvent](...args)
        })
      }
    })
  },

  unsubscribe (clientExpression: string, user?: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      if (user) {
        client.client.presence.unsubscribe(user)
      } else {
        client.client.presence.unsubscribe()
      }
    })
  },

  getAll (clientExpression: string, users?: string[]) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.presence.callbacks[queryEvent] = sinon.spy()
      if (users) {
        client.client.presence.getAll(users, (...args: any[]) => {
          client.presence.callbacks[queryEvent](...args)
        })
      } else {
        client.client.presence.getAll((...args: any[]) => {
          client.presence.callbacks[queryEvent](...args)
        })
      }
    })
  }
}
