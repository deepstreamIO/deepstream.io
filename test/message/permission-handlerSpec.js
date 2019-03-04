/* eslint-disable no-unused-vars, import/no-extraneous-dependencies, import/newline-after-import */
/* global jasmine, spyOn, describe, it, expect, beforeAll, afterEach */
'use strict'

const proxyquire = require('proxyquire').noPreserveCache()
const HttpMock = require('../mocks/http-mock')
const LoggerMock = require('../mocks/logger-mock')
const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer
const SocketWrapperMock = require('../mocks/socket-wrapper-mock')
const ConnectionEndpoint = proxyquire('../../src/message/websocket/connection-endpoint', {
  http: httpMock,
  https: httpsMock,
  './socket-wrapper': SocketWrapperMock
})
const DependencyInitialiser = require('../../src/utils/dependency-initialiser')
const SocketMock = require('../mocks/socket-mock')
const _msg = require('../test-helper/test-helper').msg

const permissionHandler = {
  isValidUser (connectionData, authData, callback) {
    callback(true, {
      username: 'someUser',
      clientData: { firstname: 'Wolfram' },
      serverData: { role: authData.role }
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
  logInvalidAuthData: true,
  unauthenticatedClientTimeout: 100
}

const mockDs = {
  _options: options
}

describe('permissionHandler passes additional user meta data', () => {
  let socketWrapperMock
  let connectionEndpoint

  beforeAll((done) => {
    connectionEndpoint = new ConnectionEndpoint(options)
    const depInit = new DependencyInitialiser(mockDs, options, connectionEndpoint, 'connectionEndpoint')
    depInit.on('ready', () => {
      connectionEndpoint.onMessages = function () {}
      socketWrapperMock = new SocketWrapperMock(new SocketMock())
      connectionEndpoint._onConnection(socketWrapperMock)
      socketWrapperMock.onMessage(_msg('C|CHR|localhost:6021+'))
      done()
    })
    connectionEndpoint._onReady()
  })

  it('sends an authentication message', () => {
    spyOn(permissionHandler, 'isValidUser').and.callThrough()
    socketWrapperMock.onMessage(_msg('A|REQ|{"role": "admin"}+'))
    expect(permissionHandler.isValidUser).toHaveBeenCalled()
    expect(permissionHandler.isValidUser.calls.mostRecent().args[1]).toEqual({ role: 'admin' })
    expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|A|O{"firstname":"Wolfram"}+'))
  })

  it('sends a record read message', () => {
    spyOn(connectionEndpoint, 'onMessages')
    socketWrapperMock.onMessage(_msg('R|CR|someRecord+'))
    expect(connectionEndpoint.onMessages).toHaveBeenCalled()
    expect(connectionEndpoint.onMessages.calls.mostRecent().args[0].authData).toEqual({ role: 'admin' })
  })
})
