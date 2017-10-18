'use strict'

const C = require('../../src/constants')
const proxyquire = require('proxyquire').noPreserveCache()
const uwsMock = require('../test-mocks/uws-mock')
const HttpMock = require('../test-mocks/http-mock')
const LoggerMock = require('../test-mocks/logger-mock')

const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer

const getTestMocks = require('../test-helper/test-mocks')

let client

const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
  uws: uwsMock,
  http: httpMock,
  https: httpsMock,
  './socket-wrapper-factory': {
    createSocketWrapper: () => {
      client = getTestMocks().getSocketWrapper('client')
      return client.socketWrapper
    }
  }
}).default
const DependencyInitialiser = require('../../src/utils/dependency-initialiser').default
const SocketMock = require('../test-mocks/socket-mock')

const permissionHandler = {
  isValidUser (connectionData, authData, callback) {
    callback(true, {
      username: 'someUser',
      clientData: { firstname: 'Wolfram' },
      serverData: { role: 'admin' }
    })
  },
  canPerformAction (username, message, callback) {
    callback(null, true)
  },
  onClientDisconnect () {}
}

const config = {
  maxAuthAttempts: 3,
  logInvalidAuthData: true
}

const services = {
  permissionHandler,
  authenticationHandler: permissionHandler,
  logger: new LoggerMock()
}

describe('permissionHandler passes additional user meta data', () => {
  let connectionEndpoint

  beforeEach((done) => {
    connectionEndpoint = new ConnectionEndpoint(config)
    const depInit = new DependencyInitialiser({ config, services }, config, services, connectionEndpoint, 'connectionEndpoint')
    depInit.on('ready', () => {
      connectionEndpoint.onMessages = function () {}
      connectionEndpoint._server._simulateUpgrade(new SocketMock())

      uwsMock.messageHandler([{
        topic: C.TOPIC.CONNECTION,
        action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE,
        data: 'localhost:6021'
      }], client.socketWrapper)

      done()
    })
  })

  it('sends an authentication message', () => {
    spyOn(permissionHandler, 'isValidUser').and.callThrough()

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        action: C.AUTH_ACTIONS.AUTH_SUCCESSFUL,
        parsedData: { firstname: 'Wolfram' }
      })

    uwsMock.messageHandler([{
      topic: C.TOPIC.AUTH,
      action: C.AUTH_ACTIONS.REQUEST,
      data: '{ "token": 1234 }'
    }], client.socketWrapper)

    expect(permissionHandler.isValidUser).toHaveBeenCalled()
    expect(permissionHandler.isValidUser.calls.mostRecent().args[1]).toEqual({ token: 1234 })

    client.socketWrapperMock.verify()
  })

  it('sends a record read message', () => {
    spyOn(connectionEndpoint, 'onMessages')

    uwsMock.messageHandler([{
      topic: C.TOPIC.AUTH,
      action: C.AUTH_ACTIONS.REQUEST,
      data: '{ "token": 1234 }'
    }], client.socketWrapper)

    uwsMock.messageHandler([{
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.READ,
      name: 'recordA'
    }], client.socketWrapper)

    expect(connectionEndpoint.onMessages).toHaveBeenCalled()
    expect(connectionEndpoint.onMessages.calls.mostRecent().args[0].authData).toEqual({ role: 'admin' })
  })
})
