import * as sinon from 'sinon'
import { clientHandler } from './client-handler'

const clients = clientHandler.clients

type ListenType = 'record' | 'event'

export const assert = {
  doesNotRecieveMatch (client: string, type: ListenType, match: boolean, pattern: string) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern].start
    sinon.assert.neverCalledWith(listenCallbackSpy, match)
  },

  recievesMatch (client: string, count: number, type: ListenType, subscriptionName: string, pattern: string) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern].start
    sinon.assert.callCount(listenCallbackSpy.withArgs(subscriptionName), Number(count))
  },

  receivedUnMatch (client: string, count: number, type: ListenType, subscriptionName: string, pattern: string) {
    const listenCallbackSpy = clients[client][type].callbacksListenersSpies[pattern].stop
    sinon.assert.callCount(listenCallbackSpy.withArgs(subscriptionName), Number(count))
  }
}

export const listening = {
  assert,

  setupListenResponse (client: string, accepts: boolean, type: ListenType, subscriptionName: string, pattern: string) {
    clients[client][type].callbacksListenersSpies[pattern].start.withArgs(subscriptionName)
    clients[client][type].callbacksListenersSpies[pattern].stop.withArgs(subscriptionName)
    clients[client][type].callbacksListenersResponse[pattern] = accepts
  },

  listens (client: string, type: ListenType, pattern: string) {
    if (!clients[client][type].callbacksListenersSpies[pattern]) {
      clients[client][type].callbacksListenersSpies[pattern] = { start: sinon.spy(), stop: sinon.spy() }
    }

    clients[client][type].callbacksListeners[pattern] = (subscriptionName: string, isSubscribed: boolean, response: any) => {
      if (isSubscribed) {
        if (clients[client][type].callbacksListenersResponse[pattern]) {
          response.accept()
        } else {
          response.reject()
        }
        clients[client][type].callbacksListenersSpies[pattern].start(subscriptionName)
      } else {
        clients[client][type].callbacksListenersSpies[pattern].stop(subscriptionName)
      }
    }
    clients[client].client[type].listen(pattern, clients[client][type].callbacksListeners[pattern])
  },

  unlistens (client: string, type: ListenType, pattern: string) {
    clients[client].client[type].unlisten(pattern)
    clients[client][type].callbacksListeners[pattern].isListening = false
  }
}
