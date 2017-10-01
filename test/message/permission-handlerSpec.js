/* eslint-disable no-unused-vars, import/no-extraneous-dependencies, import/newline-after-import */
/* global jasmine, spyOn, describe, it, expect, beforeAll, afterEach */
'use strict'

const C = require('../../src/constants/constants')
const proxyquire = require('proxyquire').noPreserveCache()
const uwsMock = require('../mocks/uws-mock')
const HttpMock = require('../mocks/http-mock')
const LoggerMock = require('../mocks/logger-mock')
const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer
const SocketWrapperMock = require('../mocks/socket-wrapper-mock')
const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
  uws: uwsMock,
  http: httpMock,
  https: httpsMock,
  './socket-wrapper': SocketWrapperMock
})
const DependencyInitialiser = require('../../src/utils/dependency-initialiser')
const SocketMock = require('../mocks/socket-mock')

const permissionHandler = {
  isValidUser (connectionData, authData, callback) {
    callback(true, {
      username: 'someUser',
      clientData: { firstname: 'Wolfram' },
      serverData: { role: 'admin' }
    })
  },
  canPerformAction (username, message, callback, data) {
    callback(null, true)
  },
  onClientDisconnect (username) {}
}

const options = {
  permissionHandler,
  authenticationHandler: permissionHandler,
  logger: new LoggerMock(),
  maxAuthAttempts: 3,
  logInvalidAuthData: true
}

const mockDs = {
  _options: options
}

describe('permissionHandler passes additional user meta data', () => {
  let socketWrapperMock
  let connectionEndpoint

  beforeEach((done) => {
    connectionEndpoint = new ConnectionEndpoint(options)
    const depInit = new DependencyInitialiser(mockDs, options, connectionEndpoint, 'connectionEndpoint')
    depInit.on('ready', () => {
      connectionEndpoint.onMessages = function () {}
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      
      uwsMock.messageHandler([{
        topic: C.TOPIC.CONNECTION,
        action: C.ACTIONS.CHALLENGE_RESPONSE,
        data: 'localhost:6021'
      }], socketWrapperMock)

      done()
    })
  })

  it('sends an authentication message', () => {
    spyOn(permissionHandler, 'isValidUser').and.callThrough()

    uwsMock.messageHandler([{
      topic: C.TOPIC.AUTH,
      action: C.ACTIONS.REQUEST,
      data: '{ "token": 1234 }'
    }], socketWrapperMock)

    expect(permissionHandler.isValidUser).toHaveBeenCalled()
    expect(permissionHandler.isValidUser.calls.mostRecent().args[1]).toEqual({ token: 1234 })
    expect(socketWrapperMock.lastSendMessage).toEqual({ 
      topic: C.TOPIC.AUTH, 
      isAck: true,
      parsedData: { firstname: 'Wolfram' } 
    })
  })

  it('sends a record read message', () => {
    spyOn(connectionEndpoint, 'onMessages')

    uwsMock.messageHandler([{
      topic: C.TOPIC.AUTH,
      action: C.ACTIONS.REQUEST,
      data: '{ "token": 1234 }'
    }], socketWrapperMock)

    uwsMock.messageHandler([{
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.READ,
      name: 'recordA'
    }], socketWrapperMock)

    expect(connectionEndpoint.onMessages).toHaveBeenCalled()
    expect(connectionEndpoint.onMessages.calls.mostRecent().args[0].authData).toEqual({ role: 'admin' })
  })
})
