/* global jasmine, spyOn, describe, it, expect, beforeAll, afterEach */
'use strict'

const proxyquire = require('proxyquire').noPreserveCache()
const uwsMock = require('../mocks/uws-mock')
const HttpMock = require('../mocks/http-mock')

const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer
const SocketWrapperMock = require('../mocks/socket-wrapper-mock')
const ConnectionEndpoint = proxyquire('../../src/message/uws-connection-endpoint', {
  uws: uwsMock,
  http: httpMock,
  https: httpsMock,
  './uws-socket-wrapper': SocketWrapperMock
})
const DependencyInitialiser = require('../../src/utils/dependency-initialiser')
const SocketMock = require('../mocks/socket-mock')
const _msg = require('../test-helper/test-helper').msg
let lastAuthenticatedMessage = null
let lastLoggedMessage = null

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
  logger: { log (logLevel, event, msg) { lastLoggedMessage = msg } },
  maxAuthAttempts: 3,
  logInvalidAuthData: true
}

const mockDs = {
  _options: options
}

describe('permissionHandler passes additional user meta data', () => {
  let socketWrapperMock

  beforeAll((done) => {
    options.connectionEndpoint = new ConnectionEndpoint(options)
    const depInit = new DependencyInitialiser(mockDs, options, 'connectionEndpoint')
    depInit.on('ready', () => {
      options.connectionEndpoint.onMessages = function (socket, messages) {
        lastAuthenticatedMessage = messages[messages.length - 1]
      }
      options.connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)

      done()
    })
  })

  it('sends an authentication message', () => {
    spyOn(permissionHandler, 'isValidUser').and.callThrough()
    uwsMock._messageHandler(_msg('A|REQ|{"role": "admin"}+'), socketWrapperMock)
    expect(permissionHandler.isValidUser).toHaveBeenCalled()
    expect(permissionHandler.isValidUser.calls.mostRecent().args[1]).toEqual({ role: 'admin' })
    expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|A|O{"firstname":"Wolfram"}+'))
  })

  it('sends a record read message', () => {
    spyOn(options.connectionEndpoint, 'onMessages')
    uwsMock._messageHandler(_msg('R|CR|someRecord+'), socketWrapperMock)
    expect(options.connectionEndpoint.onMessages).toHaveBeenCalled()
    expect(options.connectionEndpoint.onMessages.calls.mostRecent().args[0].authData).toEqual({ role: 'admin' })
  })
})
