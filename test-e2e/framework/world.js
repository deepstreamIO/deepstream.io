'use strict'

const C = require('deepstream.io-client-js').CONSTANTS
const sinon = require('sinon')
const clientHandler = require('./client-handler')
const utils = require('./utils')

module.exports = {
  endTest (done) {
    const clients = clientHandler.clients
    for (const client in clients) {
      clientHandler.assertNoErrors(client)

      for (const event in clients[client].event.callbacks) {
        if (clients[client].event.callbacks[event].isSubscribed !== false) {
          clients[client].client.event.unsubscribe(event, clients[client].event.callbacks[event])
        }
      }

      setTimeout(function (client) {
        for (const pattern in clients[client].event.callbacksListeners) {
          if (clients[client].event.callbacksListeners[pattern].isListening !== false) {
            clients[client].client.event.unlisten(pattern, clients[client].event.callbacksListeners[pattern])
          }
        }
      }.bind(null, client), 1)

      setTimeout(function (client) {
        clients[client].client.close()
        delete clients[client]
      }.bind(null, client), 50)
    }

    setTimeout(done, 100)
  }
}
