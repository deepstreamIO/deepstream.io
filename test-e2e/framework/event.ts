import * as sinon from 'sinon'
import { clientHandler } from './client-handler'
import { parseData } from './utils'

const assert = {
  received (clientExpression: string, doesReceive: boolean, subscriptionName: string, data: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const eventSpy = client.event.callbacks[subscriptionName]
      if (doesReceive) {
        sinon.assert.calledOnce(eventSpy)
        sinon.assert.calledWith(eventSpy, parseData(data))
        eventSpy.resetHistory()
      } else {
        sinon.assert.notCalled(eventSpy)
      }
    })
  },
}

export const event = {
  assert,

  publishes (clientExpression: string, subscriptionName: string, data: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.event.emit(subscriptionName, parseData(data))
    })
  },

  subscribes (clientExpression: string, subscriptionName: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.event.callbacks[subscriptionName] = sinon.spy()
      client.client.event.subscribe(subscriptionName, client.event.callbacks[subscriptionName])
    })
  },

  unsubscribes (clientExpression: string, subscriptionName: string) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.event.unsubscribe(subscriptionName, client.event.callbacks[subscriptionName])
      client.event.callbacks[subscriptionName].isSubscribed = false
    })
  }
}
