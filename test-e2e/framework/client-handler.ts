import { Client } from '@deepstream/client/dist/client'
import * as deepstream from '@deepstream/client/dist/client'
import * as sinon from 'sinon'
import { Message } from '../../src/constants'

export interface E2EClient {
  name: string,
  client: Client,
  [index: string]: any
}

const clients: { [index: string]: E2EClient } = {}

function createClient (clientName: string, server: string, options?: any) {
  const gatewayUrl = global.e2eHarness.getUrl(server)
  // @ts-ignore
  const client = new deepstream.Client(gatewayUrl, {
    ...options,
    subscriptionInterval: 5,
    maxReconnectInterval: 300,
    maxReconnectAttempts: 20,
    rpcAcceptTimeout: 100,
    rpcResponseTimeout: 300,
    subscriptionTimeout: 100,
    recordReadAckTimeout: 100,
    recordReadTimeout: 50,
    recordDeleteTimeout: 100,
    recordDiscardTimeout: 100,
    intervalTimerResolution: 1,
    offlineEnabled: false,
    offlineBufferTimeout: 10000,
    nativeTimerRegistry: false,
    initialRecordVersion: 1,
    socketOptions: {
      jsonTransportMode: false
    }
  })
  clients[clientName] = {
    name: clientName,
    client,
    login: sinon.spy(),
    error: {},
    connectionStateChanged: sinon.spy(),
    clientDataChanged: sinon.spy(),
    reauthenticationFailure: sinon.spy(),
    event: {
      callbacks: {},
      callbacksListeners: {},
      callbacksListenersSpies: {},
      callbacksListenersResponse: {},
    },
    record: {
      records: {
        // Creates a similar structure when record is requests
        xxx: {
          record: null,
          discardCallback: null,
          deleteCallback: null,
          callbackError: null,
          subscribeCallback: null,
          subscribePathCallbacks: {}
        }
      },
      lists: {
        xxx: {
          list: null,
          discardCallback: null,
          deleteCallback: null,
          callbackError: null,
          subscribeCallback: null,
          addedCallback: null,
          removedCallback: null,
          movedCallback: null
        }
      },
      anonymousRecord: null,
      snapshotCallback: sinon.spy(),
      hasCallback: sinon.spy(),
      headCallback: sinon.spy(),
      callbacksListeners: {},
      callbacksListenersSpies: {},
      callbacksListenersResponse: {},
    },
    rpc: {
      callbacks: {},
      provides: {},
      callbacksListeners: {},
      callbacksListenersSpies: {},
      callbacksListenersResponse: {},
    },
    presence: {
      callbacks: {}
    }
  }

  clients[clientName].client.on('error', (message: Message, event: string, topic: number) => {
    if (process.env.DEBUG_LOG) {
      console.log('An Error occured on', clientName, message, event, topic)
    }

    if (!clients[clientName]) {
      return
    }
    const clientErrors = clients[clientName].error
    clientErrors[topic]          = clientErrors[topic] || {}
    clientErrors[topic][event] = clientErrors[topic][event] || sinon.spy()
    clients[clientName].error[topic][event](message)
  })

  clients[clientName].client.on('connectionStateChanged', (state: string) => {
    if (!clients[clientName]) {
      return
    }
    clients[clientName].connectionStateChanged(state)
  })

  clients[clientName].client.on('clientDataChanged', (clientData: any) => {
    if (!clients[clientName]) {
      return
    }
    clients[clientName].clientDataChanged(clientData)
  })

  clients[clientName].client.on('reauthenticationFailure', (reason: string) => {
    if (!clients[clientName]) {
      return
    }
    clients[clientName].reauthenticationFailure(reason)
  })

  return clients[clientName]
}

function getClientNames (expression: string) {
  const clientExpression = /all clients|(?:subscriber|publisher|clients?) ([^\s']*)(?:'s)?/
  const result = clientExpression.exec(expression)!
  if (result[0] === 'all clients') {
    return Object.keys(clients)
  } else if (result.length === 2 && result[1].indexOf(',') > -1) {
    return result[1].replace(/"/g, '').split(',')
  } else if (result.length === 2) {
    return [result[1].replace(/"/g, '')]
  }

  throw new Error(`Invalid expression: ${expression}`)
}

function getClients (expression: string) {
  return getClientNames(expression).map((client) => clients[client])
}

function assertNoErrors (client: string) {
  const clientErrors = clients[client].error
  for (const topic in clientErrors) {
    for (const event in clientErrors[topic]) {
      sinon.assert.notCalled(clientErrors[topic][event])
    }
  }
}

export const clientHandler = {
  clients,
  createClient,
  getClientNames,
  getClients,
  assertNoErrors
}
