/* eslint-disable import/no-extraneous-dependencies, max-len */
/* global jasmine, spyOn, describe, it, expect, beforeEach, beforeAll, afterEach, afterAll */
'use strict'

const proxyquire = require('proxyquire').noPreserveCache()
const uwsMock = require('../mocks/uws-mock')
const HttpMock = require('../mocks/http-mock')
const LoggerMock = require('../mocks/logger-mock')
const DependencyInitialiser = require('../../src/utils/dependency-initialiser')
const _msg = require('../test-helper/test-helper').msg
const permissionHandlerMock = require('../mocks/permission-handler-mock')
const authenticationHandlerMock = require('../mocks/authentication-handler-mock')
const SocketMock = require('../mocks/socket-mock')
const SocketWrapperMock = require('../mocks/socket-wrapper-mock')

const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer

const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
  uws: uwsMock,
  http: httpMock,
  https: httpsMock,

  './socket-wrapper': SocketWrapperMock
})

let lastAuthenticatedMessage = null
let socketWrapperMock
let connectionEndpoint

const options = {
  unauthenticatedClientTimeout: null,
  permissionHandler: permissionHandlerMock,
  authenticationHandler: authenticationHandlerMock,
  logger: new LoggerMock(),
  maxAuthAttempts: 3,
  logInvalidAuthData: true,
  heartbeatInterval: 4000
}

const mockDs = { _options: options }

describe('connection endpoint', () => {
  beforeAll(() => {
    authenticationHandlerMock.reset()

    connectionEndpoint = new ConnectionEndpoint(options, () => {})
    const depInit = new DependencyInitialiser(mockDs, options, connectionEndpoint, 'connectionEndpoint')
    depInit.on('ready', () => {
      connectionEndpoint.onMessages()
      connectionEndpoint.onMessages = function (socket, messages) {
        lastAuthenticatedMessage = messages[messages.length - 1]
      }
    })
  })

  afterAll((done) => {
    connectionEndpoint.once('close', done)
    connectionEndpoint.close()
  })

  it('sets autopings on the websocket server', () => {
    expect(uwsMock.heartbeatInterval).toBe(options.heartbeatInterval)
    expect(uwsMock.pingMessage).toBe(_msg('C|PI+'))
  })

  describe('the connection endpoint handles invalid connection messages', () => {
    beforeEach(() => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      expect(uwsMock._lastUserData).not.toBe(null)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|CH+'))
    })

    it('handles gibberish messages', () => {
      uwsMock._messageHandler('gibberish', socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|E|MESSAGE_PARSE_ERROR|gibberish+'))
      expect(socketWrapperMock.isClosed).toBe(true)
    })

    it('handles invalid connection topic', () => {
      uwsMock._messageHandler(_msg('A|REQ|{}+'), socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|E|INVALID_MESSAGE|invalid connection message+'))
      expect(socketWrapperMock.isClosed).toBe(false)
    })

    it('handles non text based connection messages', () => {
      uwsMock._messageHandler([], socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|E|INVALID_MESSAGE|invalid connection message+'))
      expect(socketWrapperMock.isClosed).toBe(false)
    })
  })

  describe('the connection endpoint handles invalid auth messages', () => {
    it('creates the connection endpoint', () => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()

      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|CH+'))
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)

      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|A+'))
      expect(socketWrapperMock.isClosed).toBe(false)
    })

    it('handles invalid auth messages', () => {
      uwsMock._messageHandler('gibberish', socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|E|INVALID_AUTH_MSG|invalid authentication message+'))
      expect(socketWrapperMock.isClosed).toBe(true)
    })

    it('handles non text based auth messages', () => {
      uwsMock._messageHandler([], socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|E|INVALID_AUTH_MSG|invalid authentication message+'))
      expect(socketWrapperMock.isClosed).toBe(true)
    })

    it('has discarded the invalid socket', () => {
      socketWrapperMock.lastSendMessage = null
      uwsMock._messageHandler('some more gibberish', socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(null)
    })
  })

  describe('the connection endpoint handles null values', () => {
    it('creates the connection endpoint', () => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()

      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|CH+'))
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)

      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|A+'))
      expect(socketWrapperMock.isClosed).toBe(false)
    })

    it('handles invalid auth messages', () => {
      uwsMock._messageHandler('A|REQ|null+', socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|E|INVALID_AUTH_MSG|invalid authentication message+'))
      expect(socketWrapperMock.isClosed).toBe(true)
    })

    it('has discarded the invalid socket', () => {
      socketWrapperMock.lastSendMessage = null
      uwsMock._messageHandler('some more gibberish', socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(null)
    })
  })

  describe('the connection endpoint handles invalid json', () => {
    it('creates the connection endpoint', () => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|CH+'))
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|A+'))
      expect(socketWrapperMock.isClosed).toBe(false)
    })

    it('handles invalid json messages', () => {
      uwsMock._messageHandler(_msg('A|REQ|{"a":"b}+'), socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(
        _msg('A|E|INVALID_AUTH_MSG|invalid authentication message+')
      )
      expect(socketWrapperMock.isClosed).toBe(true)
    })
  })

  describe('the connection endpoint does not route invalid auth messages to the permissionHandler', () => {
    it('creates the connection endpoint', () => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)
      expect(socketWrapperMock.isClosed).toBe(false)
    })

    it('handles invalid auth messages', () => {
      expect(authenticationHandlerMock.lastUserValidationQueryArgs).toBe(null)

      authenticationHandlerMock.nextUserValidationResult = false

      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)

      expect(authenticationHandlerMock.lastUserValidationQueryArgs.length).toBe(3)
      expect(authenticationHandlerMock.lastUserValidationQueryArgs[1].user).toBe('wolfram')
      expect(options.logger.lastLogMessage.indexOf('wolfram')).not.toBe(-1)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|E|INVALID_AUTH_DATA|SInvalid User+'))
      expect(socketWrapperMock.isClosed).toBe(false)
    })
  })

  describe('the connection endpoint emits a client events for user with name', () => {
    beforeAll(() => {
      authenticationHandlerMock.nextUserValidationResult = true
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)
    })

    it('client has the correct connection data', () => {
      // {
      //    remoteAddress: 'xxx',
      //    headers: {
      //    },
      //    referrer: 'xxx'
      // }
      const connectionData = socketWrapperMock.getHandshakeData()
      expect(connectionData.remoteAddress).toBe('127.0.0.1')
      expect(connectionData.headers).toBeDefined()
    })

    it('emits connected event for user with name', (done) => {
      connectionEndpoint.once('client-connected', (socketWrapper) => {
        expect(socketWrapper.user).toBe('test-user')
        done()
      })

      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)
    })

    it('emits disconnected event for user with name', (done) => {
      connectionEndpoint.once('client-disconnected', (socketWrapper) => {
        expect(socketWrapper.user).toBe('test-user')
        done()
      })

      socketWrapperMock.socket.close()
    })
  })


  describe('the connection endpoint deosn\'t emit client events for user without a name', () => {
    beforeAll(() => {
      authenticationHandlerMock.nextUserIsAnonymous = true
      authenticationHandlerMock.nextUserValidationResult = true
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)
    })

    afterAll(() => {
      authenticationHandlerMock.nextUserIsAnonymous = false
    })

    it('does not emit connected event', () => {
      authenticationHandlerMock.nextUserIsAnonymous = true
      const spy = jasmine.createSpy('client-connected')

      connectionEndpoint.once('client-connected', spy)
      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)

      expect(spy).not.toHaveBeenCalled()
    })

    it('does not emit disconnected event', () => {
      authenticationHandlerMock.nextUserIsAnonymous = true
      const spy = jasmine.createSpy('client-disconnected')

      connectionEndpoint.once('client-disconnected', spy)
      socketWrapperMock.socket.close()

      expect(spy).not.toHaveBeenCalled()
    })
  })


  describe('disconnects if the number of invalid authentication attempts is exceeded', () => {
    it('creates the connection endpoint', () => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)
    })

    it('handles valid auth messages', () => {
      authenticationHandlerMock.nextUserValidationResult = false
      options.maxAuthAttempts = 3

      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|E|INVALID_AUTH_DATA|SInvalid User+'))
      expect(socketWrapperMock.isClosed).toBe(false)

      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|E|INVALID_AUTH_DATA|SInvalid User+'))
      expect(socketWrapperMock.isClosed).toBe(false)

      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|E|TOO_MANY_AUTH_ATTEMPTS|Stoo many authentication attempts+'))
      expect(socketWrapperMock.isClosed).toBe(true)
    })
  })

  describe('disconnects client if authentication timeout is exceeded', () => {
    beforeAll(() => {
      connectionEndpoint._unauthenticatedClientTimeout = 100
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
    })

    afterAll(() => {
      connectionEndpoint._unauthenticatedClientTimeout = null
    })

    it('disconnects client after timeout and sends force close', (done) => {
      setTimeout(() => {
        expect(socketWrapperMock.lastSendMessage).toBe(_msg('C|E|CONNECTION_AUTHENTICATION_TIMEOUT|Sconnection has not authenticated successfully in the expected time+'))
        expect(socketWrapperMock.isClosed).toBe(true)
        done()
      }, 150)
    })
  })

  describe('the connection endpoint routes valid auth messages to the permissionHandler', () => {
    it('creates the connection endpoint', () => {
      authenticationHandlerMock.onClientDisconnectCalledWith = null
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)
    })

    it('authenticates valid sockets', () => {
      authenticationHandlerMock.nextUserValidationResult = true

      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)

      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|A+'))
      expect(socketWrapperMock.isClosed).toBe(false)
    })

    it('forwards messages from authenticated sockets', () => {
      expect(lastAuthenticatedMessage).toBe(null)
      uwsMock._messageHandler(_msg('E|EVT|testMsg+'), socketWrapperMock)
      expect(lastAuthenticatedMessage).toEqual({ raw: _msg('E|EVT|testMsg'), topic: 'E', action: 'EVT', data: ['testMsg'] })
    })

    it('notifies the permissionHandler when a client disconnects', () => {
      socketWrapperMock.socket.close()
      expect(authenticationHandlerMock.onClientDisconnectCalledWith).toBe('test-user')
    })
  })

  describe('forwards additional data for positive authentications', () => {
    it('creates the connection endpoint', () => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)

      authenticationHandlerMock.reset()
      authenticationHandlerMock.nextUserValidationResult = true
      authenticationHandlerMock.sendNextValidAuthWithData = true
    })

    it('authenticates valid sockets', () => {
      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)
      expect(socketWrapperMock.lastSendMessage).toBe(_msg('A|A|Stest-data+'))
    })
  })

  describe('closes all client connections on close', () => {
    const closeSpy = jasmine.createSpy('close-event')
    let unclosedSocket

    beforeAll(() => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()
      unclosedSocket.autoClose = false
      connectionEndpoint.once('close', closeSpy)
      connectionEndpoint.close()
    })

    it('did not emit close event', () => {
      expect(closeSpy).not.toHaveBeenCalled()
    })

    it('closes the last remaining client connection', (done) => {
      connectionEndpoint.once('close', done)
      expect(closeSpy).not.toHaveBeenCalled()
      unclosedSocket.doClose()
    })

    it('has closed the server', () => {
      expect(closeSpy).toHaveBeenCalled()
    })

    it('does not allow future connections', () => {
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      socketWrapperMock = uwsMock.simulateConnection()

      expect(socketWrapperMock.lastSendMessage).toBe(null)
      expect(socketWrapperMock.isClosed).toBe(false)

      uwsMock._messageHandler('gibberish', socketWrapperMock)

      expect(socketWrapperMock.lastSendMessage).toBe(null)
      expect(socketWrapperMock.isClosed).toBe(false)
    })
  }).pend('Test manually to see behaviour, UTs doesn\'t work')


  describe('connection endpoint doesn\'t log credentials if logInvalidAuthData is set to false', () => {
    it('creates the connection endpoint', (done) => {
    // re-initialize ConnectionEndpoint to get modified config
      const options2 = Object.assign({}, options)
      options2.logInvalidAuthData = false
      const connectionEndpoint2 = new ConnectionEndpoint(options2, () => {})
      const depInit = new DependencyInitialiser({ _options: options2 }, options2, connectionEndpoint2, 'connectionEndpoint')
      depInit.on('ready', () => {
        connectionEndpoint2._server._simulateUpgrade(new SocketMock())
        socketWrapperMock = uwsMock.simulateConnection()
        uwsMock._messageHandler(_msg('C|CHR|localhost:6021+'), socketWrapperMock)
        done()
      })
    })

    it('handles valid auth messages', () => {
      authenticationHandlerMock.nextUserValidationResult = false
      uwsMock._messageHandler(_msg('A|REQ|{"user":"wolfram"}+'), socketWrapperMock)
      expect(options.logger.lastLogMessage.indexOf('wolfram')).toBe(-1)
    })
  })
})
