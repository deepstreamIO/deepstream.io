import * as sinon from 'sinon'
import { clientHandler } from './client-handler'

const clients = clientHandler.clients

export const assert = {
  doesNotRecieveMatch (client, type, match, pattern) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern].start
    sinon.assert.neverCalledWith(listenCallbackSpy, match)
  },

  recievesMatch (client, count, type, subscriptionName, pattern) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern].start
    sinon.assert.callCount(listenCallbackSpy.withArgs(subscriptionName), Number(count))
  },

  recievedUnMatch (client, count, type, subscriptionName, pattern) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern].stop
    sinon.assert.callCount(listenCallbackSpy.withArgs(subscriptionName), Number(count))
  }
}

export const listening = {
  assert,

  setupListenResponse (client, accepts, type, subscriptionName, pattern) {
    clients[client][type].callbacksListenersSpies[pattern].start.withArgs(subscriptionName)
    clients[client][type].callbacksListenersSpies[pattern].stop.withArgs(subscriptionName)
    clients[client][type].callbacksListenersResponse[pattern] = accepts
  },

  listens (client, type, pattern) {
    if (!clients[client][type].callbacksListenersSpies[pattern]) {
      clients[client][type].callbacksListenersSpies[pattern] = { start: sinon.spy(), stop: sinon.spy() }
    }

    clients[client][type].callbacksListeners[pattern] = (subscriptionName, response) => {
      if (clients[client][type].callbacksListenersResponse[pattern]) {
        response.accept()
      } else {
        response.reject()
      }
      response.onStop(clients[client][type].callbacksListenersSpies[pattern].stop)
      clients[client][type].callbacksListenersSpies[pattern].start(subscriptionName)
    }
    clients[client].client[type].listen(pattern, clients[client][type].callbacksListeners[pattern])
  },

  unlistens (client, type, pattern) {
    clients[client].client[type].unlisten(pattern)
    clients[client][type].callbacksListeners[pattern].isListening = false
  }
}
