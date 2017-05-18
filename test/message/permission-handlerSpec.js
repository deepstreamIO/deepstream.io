/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let proxyquire = require('proxyquire').noCallThru(),
  uwsMock = require('../mocks/uws-mock'),
  HttpMock = require('../mocks/http-mock'),
  httpMock = new HttpMock(),
  httpsMock = new HttpMock(),
  SocketWrapperMock = require('../mocks/socket-wrapper-mock'),
  ConnectionEndpoint = proxyquire('../../src/message/uws-connection-endpoint', {
    uws: uwsMock,
    http: httpMock,
    https: httpsMock,
    './uws-socket-wrapper': SocketWrapperMock
  }),
  SocketMock = require('../mocks/socket-mock'),
  _msg = require('../test-helper/test-helper').msg,
  lastAuthenticatedMessage = null,
  lastLoggedMessage = null,
  permissionHandler,
  options,
  connectionEndpoint

permissionHandler = {
  isValidUser(connectionData, authData, callback) {
    callback(true, {
        	username: 'someUser',
        	clientData: { firstname: 'Wolfram' },
        	serverData: { role: authData.role }
    })
  },
  canPerformAction(username, message, callback, data) {
    callback(null, true)
  },
  onClientDisconnect(username) {}
}

options = {
  permissionHandler,
  authenticationHandler: permissionHandler,
  logger: { log(logLevel, event, msg) { lastLoggedMessage = msg } },
  maxAuthAttempts: 3,
  logInvalidAuthData: true
}

describe('permissionHandler passes additional user meta data', () => {
  let socketWrapperMock

  beforeAll(() => {
    connectionEndpoint = new ConnectionEndpoint(options, () => {})
    connectionEndpoint.onMessages = function (socket, messages) {
      lastAuthenticatedMessage = messages[messages.length - 1]
    }
    connectionEndpoint._server._simulateUpgrade(new SocketMock())
    socketWrapperMock = uwsMock.simulateConnection()
    uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)
  })

  it('sends an authentication message', () => {
    spyOn(permissionHandler, 'isValidUser').and.callThrough()
    uwsMock._messageHandler(_msg('A|REQ|{"role": "admin"}+'), socketWrapperMock)
    expect(permissionHandler.isValidUser).toHaveBeenCalled()
    expect(permissionHandler.isValidUser.calls.mostRecent().args[1]).toEqual({ role: 'admin' })
    expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|A|O{"firstname":"Wolfram"}+'))
  })

  it('sends a record read message', () => {
    spyOn(connectionEndpoint, 'onMessages')
    uwsMock._messageHandler(_msg('R|CR|someRecord+'), socketWrapperMock)
    expect(connectionEndpoint.onMessages).toHaveBeenCalled()
    expect(connectionEndpoint.onMessages.calls.mostRecent().args[0].authData).toEqual({ role: 'admin' })
  })
})
