/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let proxyquire = require('proxyquire').noCallThru(),
  websocketMock = require('../mocks/websocket-mock'),
  HttpMock = require('../mocks/http-mock'),
  httpMock = new HttpMock(),
  httpsMock = new HttpMock(),
  ConnectionEndpoint = proxyquire('../../src/message/connection-endpoint', { uws: websocketMock, http: httpMock, https: httpsMock }),
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
  let socketMock

  beforeAll(() => {
    connectionEndpoint = new ConnectionEndpoint(options, () => {})
    connectionEndpoint.onMessage = function (socket, message) {
      lastAuthenticatedMessage = message
    }
    socketMock = websocketMock.simulateConnection()
    socketMock.emit('message', _msg('C|CHR|localhost:6021+'))
  })

  it('sends an authentication message', () => {
    spyOn(permissionHandler, 'isValidUser').and.callThrough()
    socketMock.emit('message', _msg('A|REQ|{"role": "admin"}+'))
    expect(permissionHandler.isValidUser).toHaveBeenCalled()
    expect(permissionHandler.isValidUser.calls.mostRecent().args[1]).toEqual({ role: 'admin' })
    expect(socketMock.lastSendMessage).toBe(_msg('A|A|O{"firstname":"Wolfram"}+'))
  })

  it('sends a record read message', () => {
    spyOn(connectionEndpoint, 'onMessage')
    socketMock.emit('message', _msg('R|CR|someRecord+'))
    expect(connectionEndpoint.onMessage).toHaveBeenCalled()
    expect(connectionEndpoint.onMessage.calls.mostRecent().args[0].authData).toEqual({ role: 'admin' })
  })
})
