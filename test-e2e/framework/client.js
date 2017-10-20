'use strict'

const C = require('deepstream.io-client-js').CONSTANTS
const sinon = require('sinon')

const clientHandler = require('./client-handler')
const utils = require('./utils')

module.exports = {
  logsOut (clientExpression, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.close()
    })
    // current sync since protocol doesn't yet support async
    done()
  },

  connect (clientExpression, server) {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      clientHandler.createClient(clientName, server)
    })
  },

  connectAndLogin (clientExpression, server, done) {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = clientHandler.createClient(clientName, server)
      client.client.login({ username: clientName, password: 'abcdefgh' }, () => {
        client.user = clientName
        done()
      })
    })
  },

  login (clientExpression, username, password, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.login({
        username,
        password
      }, (success, data) => {
        client.login(success, data)
        client.user = username
        done()
      })
    })
  },

  attemptLogin (clientExpression, username, password) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.login({
        username,
        password
      })
    })
  },

  recievedTooManyLoginAttempts (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const loginSpy = client.login
      sinon.assert.callCount(loginSpy, 2)
      sinon.assert.calledWith(loginSpy, false, undefined)
      sinon.assert.calledWith(loginSpy, false, 'too many authentication attempts')
      loginSpy.reset()
    })
  },

  recievesNoLoginResponse (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      sinon.assert.notCalled(client.login)
    })
  },

  recievesLoginResponse (clientExpression, loginFailed, data) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const loginSpy = client.login
      if (!loginFailed) {
        sinon.assert.calledOnce(loginSpy)
        if (data) {
          sinon.assert.calledWith(loginSpy, true, JSON.parse(data))
        } else {
          sinon.assert.calledWith(loginSpy, true, null)
        }
      } else {
        sinon.assert.calledOnce(loginSpy)
        sinon.assert.calledWith(loginSpy, false)
      }
      loginSpy.reset()
    })
  },

  connectionTimesOut (clientExpression, done) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      setTimeout(() => {
        const errorSpy = client.error[C.TOPIC.CONNECTION][C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT]
        sinon.assert.calledOnce(errorSpy)
        errorSpy.reset()
        done()
      }, 1000)
    })
  },

  recievedErrorOnce (clientExpression, topicName, eventName) {
    const topic = C.TOPIC[topicName.toUpperCase()]
    const event = C.EVENT[eventName.toUpperCase()]

    clientHandler.getClients(clientExpression).forEach((client) => {
      const errorSpy = client.error[topic][event]
      sinon.assert.called(errorSpy)
      errorSpy.reset()
    })
  },

  recievedOneError (clientExpression, topicName, eventName) {
    const topic = C.TOPIC[topicName.toUpperCase()]
    const event = C.EVENT[eventName.toUpperCase()]

    clientHandler.getClients(clientExpression).forEach((client) => {
      const errorSpy = client.error[topic][event]
      sinon.assert.calledOnce(errorSpy)
      errorSpy.reset()
    })
  },

  recievedNoErrors (clientExpression) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      clientHandler.assertNoErrors(client.name)
    })
  },

  hadConnectionState (clientExpression, had, state) {
    clientHandler.getClients(clientExpression).forEach((client) => {
      if (had) sinon.assert.calledWith(client.connectionStateChanged, state)
      else sinon.assert.neverCalledWith(client.connectionStateChanged, state)
    })
  }
}
