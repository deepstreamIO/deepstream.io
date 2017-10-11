'use strict'

const C = require('../../src/constants')
const proxyquire = require('proxyquire').noPreserveCache()
const uwsMock = require('../test-mocks/uws-mock')
const HttpMock = require('../test-mocks/http-mock')
const LoggerMock = require('../test-mocks/logger-mock')
const DependencyInitialiser = require('../../src/utils/dependency-initialiser').default
const PermissionHandlerMock = require('../test-mocks/permission-handler-mock')
const AuthenticationHandlerMock = require('../test-mocks/authentication-handler-mock')
const SocketMock = require('../test-mocks/socket-mock')

const getTestMocks = require('../test-helper/test-mocks')

const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer

let client
let handshakeData

const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
  uws: uwsMock,
  http: httpMock,
  https: httpsMock,
  './socket-wrapper-factory': {
    create: (options, data) => {
      handshakeData = data
      client = getTestMocks().getSocketWrapper('client')
      return client.socketWrapper
    }
  }
})

let lastAuthenticatedMessage = null
let connectionEndpoint

let authenticationHandlerMock
let config
let services

xdescribe('connection endpoint', () => {
  beforeEach((done) => {
    authenticationHandlerMock = new AuthenticationHandlerMock()

    config = {
      unauthenticatedClientTimeout: null,
      maxAuthAttempts: 3,
      logInvalidAuthData: true,
      heartbeatInterval: 4000
    }

    services = {
      authenticationHandler: authenticationHandlerMock,
      logger: new LoggerMock(),
      permissionHandler: new PermissionHandlerMock()
    }

    connectionEndpoint = new ConnectionEndpoint(config, services)
    const depInit = new DependencyInitialiser({ config, services }, config, services, connectionEndpoint, 'connectionEndpoint')
    depInit.on('ready', () => {
      connectionEndpoint._unauthenticatedClientTimeout = 100
      connectionEndpoint.onMessages()
      connectionEndpoint.onMessages = function (socket, parsedMessages) {
        lastAuthenticatedMessage = parsedMessages[parsedMessages.length - 1]
      }
      connectionEndpoint._server._simulateUpgrade(new SocketMock())
      expect(uwsMock._lastUserData).not.toBe(null)
      done()
    })
  })

  afterEach((done) => {
    connectionEndpoint.once('close', done)
    connectionEndpoint.close()
    client.socketWrapperMock.verify()
  })

  it('sets autopings on the websocket server', () => {
    expect(uwsMock.heartbeatInterval).toBe(config.heartbeatInterval)
    expect(uwsMock.pingMessage).toBe({
      topic: C.TOPIC.CONNECTION,
      action: C.ACTIONS.PING
    })
  }).pend('We need to figure out how to get this to work')

  describe('the connection endpoint handles invalid connection messages', () => {
    it('handles gibberish messages', () => {
      client.socketWrapperMock
        .expects('sendError')
        .once()
        .withExactArgs({
          topic: C.TOPIC.CONNECTION,
        }, C.EVENT.MESSAGE_PARSE_ERROR, 'gibbeerish')

      client.socketWrapperMock
        .expects('destroy')
        .once()
        .withExactArgs()

      uwsMock.messageHandler([{ parseError: true, raw: 'gibbeerish' }], client.socketWrapper)
    })

    it('handles invalid connection topic', () => {
      client.socketWrapperMock
        .expects('sendError')
        .once()
        .withExactArgs({
          topic: C.TOPIC.CONNECTION,
        }, C.EVENT.INVALID_MESSAGE, 'gibbeerish')

      client.socketWrapperMock
        .expects('destroy')
        .never()

      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, raw: 'gibbeerish' }], client.socketWrapper)
    })
  })

  it('the connection endpoint handles invalid auth messages', () => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
      }, C.EVENT.MESSAGE_PARSE_ERROR, 'gibbeerish')

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ parseError: true, raw: 'gibbeerish' }], client.socketWrapper)
  })

  it('the connection endpoint handles auth null data', () => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
      }, C.EVENT.INVALID_AUTH_MSG)

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: 'null' }], client.socketWrapper)
  })

  it('the connection endpoint handles invalid auth json', () => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
      }, C.EVENT.INVALID_AUTH_MSG)

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{ invalid }' }], client.socketWrapper)
  })

  it('the connection endpoint does not route invalid auth messages to the permissionHandler', () => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        parsedData: 'Invalid User'
      }, C.EVENT.INVALID_AUTH_DATA)

    expect(authenticationHandlerMock.lastUserValidationQueryArgs).toBe(null)
    authenticationHandlerMock.nextUserValidationResult = false

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"wolfram"}' }], client.socketWrapper)

    expect(authenticationHandlerMock.lastUserValidationQueryArgs.length).toBe(3)
    expect(authenticationHandlerMock.lastUserValidationQueryArgs[1].user).toBe('wolfram')
    expect(services.logger.lastLogMessage.indexOf('wolfram')).not.toBe(-1)
  })

  describe('the connection endpoint emits a client events for user with name', () => {
    beforeEach(() => {
      uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    })

    it('client has the correct connection data', () => {
      expect(handshakeData.remoteAddress).toBe('127.0.0.1')
      expect(handshakeData.headers).toBeDefined()
    })

    it('emits connected event for user with name', (done) => {
      connectionEndpoint.once('client-connected', (socketWrapper) => {
        expect(socketWrapper.user).toBe('test-user')
        done()
      })
      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
    })

    it('emits disconnected event for user with name', (done) => {
      connectionEndpoint.once('client-disconnected', (socketWrapper) => {
        expect(socketWrapper.user).toBe('test-user')
        done()
      })

      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
      client.socketWrapper.close()
    })
  })

  describe('the connection endpoint doesn\'t emit client events for user without a name', () => {
    beforeEach(() => {
      authenticationHandlerMock.nextUserIsAnonymous = true
      authenticationHandlerMock.nextUserValidationResult = true
      uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    })

    it('does not emit connected event', () => {
      const spy = jasmine.createSpy('client-connected')
      connectionEndpoint.once('client-connected', spy)

      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)

      expect(spy).not.toHaveBeenCalled()
    })

    it('does not emit disconnected event', () => {
      authenticationHandlerMock.nextUserIsAnonymous = true
      const spy = jasmine.createSpy('client-disconnected')

      connectionEndpoint.once('client-disconnected', spy)

      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
      client.socketWrapper.close()

      expect(spy).not.toHaveBeenCalled()
    })
  })

  it('disconnects if the number of invalid authentication attempts is exceeded', () => {
    authenticationHandlerMock.nextUserValidationResult = false
    config.maxAuthAttempts = 3
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendError')
      .thrice()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        parsedData: 'Invalid User'
      }, C.EVENT.INVALID_AUTH_DATA)

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH
      }, C.EVENT.TOO_MANY_AUTH_ATTEMPTS)

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
  })

  it('disconnects client if authentication timeout is exceeded', (done) => {
    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs({
        topic: C.TOPIC.CONNECTION
      }, C.EVENT.CONNECTION_AUTHENTICATION_TIMEOUT)

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    setTimeout(done, 150)
  })

  it('authenticates valid sockets', () => {
    authenticationHandlerMock.nextUserValidationResult = true

    client.socketWrapperMock
      .expects('sendError')
      .never()

    client.socketWrapperMock
      .expects('destroy')
      .never()

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        isAck: true,
        parsedData: undefined
      })

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
  })

  it('notifies the permissionHandler when a client disconnects', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)

    client.socketWrapper.close()

    expect(authenticationHandlerMock.onClientDisconnectCalledWith).toBe('test-user')
  })

  it('routes valid auth messages to the permissionHandler', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.EVENT, action: C.ACTIONS.EVENT, data: 'test' }], client.socketWrapper)

    expect(lastAuthenticatedMessage).toEqual({ topic: C.TOPIC.EVENT, action: C.ACTIONS.EVENT, data: 'test' })
  })

  it('forwards additional data for positive authentications', () => {
    authenticationHandlerMock.nextUserValidationResult = true
    authenticationHandlerMock.sendNextValidAuthWithData = true

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        isAck: true,
        parsedData: 'test-data'
      })

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
  })

  it('connection endpoint doesn\'t log credentials if logInvalidAuthData is set to false', () => {
    config.logInvalidAuthData = false
    authenticationHandlerMock.nextUserValidationResult = false

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)

    expect(services.logger.lastLogMessage.indexOf('wolfram')).toBe(-1)
  })
})
