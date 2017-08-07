'use strict'

const sinon = require('sinon')

const clients = {}

const utils = require('./utils')

const DeepstreamClient = require('deepstream.io-client-js')

function createClient(clientName, server) {
  const gatewayUrl = global.cluster.getUrl(server - 1, clientName)
  const client = DeepstreamClient(gatewayUrl, {
    maxReconnectInterval: 300,
    maxReconnectAttempts: 20,
  })
  clients[clientName] = {
    name: clientName,
    client,
    login: sinon.spy(),
    error: {},
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

  clients[clientName].client.on('error', (message, event, topic) => {
    console.log('An Error occured on', clientName, message, event, topic)

    const clientErrors = clients[clientName].error
    clientErrors[topic]          = clientErrors[topic] || {}
    clientErrors[topic][event] = clientErrors[topic][event] || sinon.spy()
    clients[clientName].error[topic][event](message)
  })

  return clients[clientName]
}

function getClientNames(expression) {
  const clientExpression = /all clients|(?:subscriber|publisher|clients?) ([^\s']*)(?:'s)?/
  const result = clientExpression.exec(expression)
  if (result[0] === 'all clients') {
    return Object.keys(clients)
  } else if (result.length === 2 && result[1].indexOf(',') > -1) {
    return result[1].replace(/"/g, '').split(',')
  } else if (result.length === 2) {
    return [result[1].replace(/"/g, '')]
  }

  throw `Invalid expression: ${expression}`

}

function getClients(expression) {
  return getClientNames(expression).map(client => clients[client])
}

function assertNoErrors(client) {
  const clientErrors = clients[client].error
  for (const topic in clientErrors) {
    for (const event in clientErrors[topic]) {
      sinon.assert.notCalled(clientErrors[topic][event])
    }
  }
}

module.exports = {
  clients,
  createClient,
  getClientNames,
  getClients,
  assertNoErrors
}
