'use strict'

const sinon = require('sinon')
const C = require('deepstream.io-client-js').CONSTANTS

const clientHandler = require('./client-handler')

const clients = clientHandler.clients

const { When, Then, Given, Before, After } = require('cucumber')


Then(/^(.+) receives? at least one "([^"]*)" error "([^"]*)"$/, (clientExpression, topicName, eventName) => {
    const topic = C.TOPIC[topicName.toUpperCase()]
    const event = C.EVENT[eventName.toUpperCase()]

    clientHandler.getClients(clientExpression).forEach((client) => {
      const errorSpy = client.error[topic][event]
      sinon.assert.called(errorSpy)
      errorSpy.reset()
    })
  })

Then(/^(.+) receives? "([^"]*)" error "([^"]*)"$/, (clientExpression, topicName, eventName) => {
    const topic = C.TOPIC[topicName.toUpperCase()]
    const event = C.EVENT[eventName.toUpperCase()]

    clientHandler.getClients(clientExpression).forEach((client) => {
      const errorSpy = client.error[topic][event]
      sinon.assert.calledOnce(errorSpy)
      errorSpy.reset()
    })
  })

Then(/^(.+) received? no errors$/, (clientExpression) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      clientHandler.assertNoErrors(client.name)
    })
  })

  /** ******************************************************************************************************************************
   *************************************************** Boiler Plate ***************************************************************
   ********************************************************************************************************************************/

Before((/* scenario*/) => {
    // client are connecting via "Background" explictly
  })

After((scenario, done) => {
    for (const client in clients) {

      clientHandler.assertNoErrors(client)

      for (const event in clients[client].event.callbacks) {
        if (clients[client].event.callbacks[event].isSubscribed !== false) {
          clients[client].client.event.unsubscribe(event, clients[client].event.callbacks[event])
        }
      }

      setTimeout((client) => {
        for (const pattern in clients[client].event.callbacksListeners) {
          if (clients[client].event.callbacksListeners[pattern].isListening !== false) {
            clients[client].client.event.unlisten(pattern, clients[client].event.callbacksListeners[pattern])
          }
        }
      }.bind(null, client), 1)

      setTimeout((client) => {
        clients[client].client.close()
        delete clients[client]
      }.bind(null, client), 50)
    }

    setTimeout(done, 100)
  })

