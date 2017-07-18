'use strict'

const sinon = require('sinon')

const C = require('deepstream.io-client-js/src/constants/constants')

const clientHandler = require('./client-handler')
const utils = require('./utils')

const clients = clientHandler.clients

module.exports = function () {

  /*
  this.Then(/^(.+) receives? at least one "([^"]*)" error "([^"]*)"$/, ( clientExpression, topicName, eventName ) => {
    const topic = C.TOPIC[ topicName.toUpperCase() ];
    const event = C.EVENT[ eventName.toUpperCase() ];

    clientHandler.getClients( clientExpression ).forEach( ( client ) => {
  */
  this.Given(/^(.+) logs? out$/, (clientExpression, done) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.close()
      setTimeout(done, utils.defaultDelay)
    })
  })

  this.Given(/^(.+) connects to server (\d+)$/, (clientExpression, server, done) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      clientHandler.createClient(clientName, server)
      done()
    })
  })

  this.Given(/^(.+) connects? and logs? into server (\d+)$/, (clientExpression, server, done) => {
    clientHandler.getClientNames(clientExpression).forEach((clientName) => {
      const client = clientHandler.createClient(clientName, server)
      client.client.login({ username: clientName, password: 'abcdefgh' }, () => {
        client.user = clientName
        setTimeout(done, utils.defaultDelay)
      })
    })
  })

  this.Given(/^(.+) logs? in with username "([^"]*)" and password "([^"]*)"$/, (clientExpression, username, password, done) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.login({
        username,
        password
      }, (success, data) => {
        client.login(success, data)
        client.user = username
        setTimeout(done, utils.defaultDelay)
      })
    })
  })

  this.When(/^(.+) attempts? to login with username "([^"]*)" and password "([^"]*)"$/, (clientExpression, username, password) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      client.client.login({
        username,
        password
      })
    })
  })

  this.Then(/^(.+) (?:is|are) notified of too many login attempts$/, (clientExpression) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const loginSpy = client.login
      sinon.assert.callCount(loginSpy, 2)
      sinon.assert.calledWith(loginSpy, false, undefined)
      sinon.assert.calledWith(loginSpy, false, 'too many authentication attempts')
      loginSpy.reset()
    })
  })

  this.Then(/^(.+) receives? (no|an (un)?authenticated) login response(?: with data (\{.*\}))?$/, (clientExpression, no, unauth, data) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      const loginSpy = client.login
      if (no.match(/^no$/)) {
        sinon.assert.notCalled(loginSpy)
      } else if (!unauth) {
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
  })

  this.Then(/^(.+) connections? times? out$/, (clientExpression, done) => {
    clientHandler.getClients(clientExpression).forEach((client) => {
      setTimeout(() => {
        const errorSpy = client.error[C.TOPIC.CONNECTION][C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT]
        sinon.assert.calledOnce(errorSpy)
        errorSpy.reset()
        done()
      }, 1000)
    })
  })

}
