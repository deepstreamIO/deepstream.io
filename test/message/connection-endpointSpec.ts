import * as C from '../../src/constants'
const proxyquire = require('proxyquire').noPreserveCache()
import uwsMock from '../test-mocks/uws-mock'
import HttpMock from '../test-mocks/http-mock'
import LoggerMock from '../test-mocks/logger-mock'
import DependencyInitialiser from '../../src/utils/dependency-initialiser'
import PermissionHandlerMock from '../test-mocks/permission-handler-mock'
import AuthenticationHandlerMock from '../test-mocks/authentication-handler-mock'
import SocketMock from '../test-mocks/socket-mock'

import { getTestMocks } from '../test-helper/test-mocks'

const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer

let client
let handshakeData

const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
  'uws': uwsMock,
  'http': httpMock,
  'https': httpsMock,
  './socket-wrapper-factory': {
    createSocketWrapper: (options, data) => {
      handshakeData = data
      client = getTestMocks().getSocketWrapper('client')
      return client.socketWrapper
    }
  }
}).default

let lastAuthenticatedMessage = null
let connectionEndpoint

let authenticationHandlerMock
let config
let services

describe('connection endpoint', () => {
  beforeEach(done => {
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
      connectionEndpoint.unauthenticatedClientTimeout = 100
      connectionEndpoint.onMessages()
      connectionEndpoint.onMessages = function (socket, parsedMessages) {
        lastAuthenticatedMessage = parsedMessages[parsedMessages.length - 1]
      }
      connectionEndpoint.server._simulateUpgrade(new SocketMock())
      expect(uwsMock.lastUserData).not.toBe(null)
      done()
    })
  })

  afterEach(done => {
    connectionEndpoint.once('close', done)
    connectionEndpoint.close()
    client.socketWrapperMock.verify()
  })

  xit('sets autopings on the websocket server', () => {
    expect(uwsMock.heartbeatInterval).toBe(config.heartbeatInterval)
    expect(uwsMock.pingMessage).toBe({
      topic: C.TOPIC.CONNECTION,
      action: C.CONNECTION_ACTIONS.PING
    })
  })

  describe('the connection endpoint handles invalid connection messages', () => {
    it('handles invalid connection topic', () => {
      client.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.CONNECTION,
          action: C.CONNECTION_ACTIONS.INVALID_MESSAGE,
          originalTopic: C.TOPIC.AUTH,
          originalAction: C.AUTH_ACTIONS.AUTH_UNSUCCESSFUL,
          data: 'gibbeerish'
        })

      client.socketWrapperMock
        .expects('destroy')
        .never()
      const message: C.Message = {
        topic: C.TOPIC.AUTH,
        action: C.AUTH_ACTIONS.AUTH_UNSUCCESSFUL,
        raw: 'gibbeerish'
      }
      uwsMock.messageHandler([message], client.socketWrapper)
    })
  })

  it('the connection endpoint handles parser errors', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.PARSER,
        action: C.PARSER_ACTIONS.UNKNOWN_ACTION,
        data: Buffer.from('gibbeerish'),
        originalTopic: 5,
        originalAction: 177
      })

    client.socketWrapperMock
      .expects('destroy')
      .withExactArgs()

    const message: C.ParseError = {
      parseError: true,
      action: C.PARSER_ACTIONS.UNKNOWN_ACTION,
      parsedMessage: {
        topic: 5,
        action: 177
      },
      description: 'unknown RECORD action 177',
      raw: Buffer.from('gibbeerish')
    }
    uwsMock.messageHandler([message], client.socketWrapper)
  })

  it('the connection endpoint handles invalid auth messages', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        action: C.AUTH_ACTIONS.INVALID_MESSAGE,
        originalTopic: C.TOPIC.EVENT,
        originalAction: C.EVENT_ACTIONS.EMIT,
        data: 'gibbeerish'
      })

    client.socketWrapperMock
      .expects('destroy')
      .never()

    const message: C.Message = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTIONS.EMIT,
      raw: 'gibbeerish'
    }
    uwsMock.messageHandler([message], client.socketWrapper)
  })

  it('the connection endpoint handles auth null data', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        action: C.AUTH_ACTIONS.INVALID_MESSAGE_DATA,
        originalAction: C.RPC_ACTIONS.REQUEST,
      })

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: 'null' }], client.socketWrapper)
  })

  it('the connection endpoint handles invalid auth json', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        action: C.AUTH_ACTIONS.INVALID_MESSAGE_DATA,
        originalAction: C.RPC_ACTIONS.REQUEST,
      })

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{ invalid }' }], client.socketWrapper)
  })

  it('the connection endpoint does not route invalid auth messages to the permissionHandler', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        parsedData: 'Invalid User',
        action: C.AUTH_ACTIONS.AUTH_UNSUCCESSFUL,
      })

    expect(authenticationHandlerMock.lastUserValidationQueryArgs).toBe(null)
    authenticationHandlerMock.nextUserValidationResult = false

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"wolfram"}' }], client.socketWrapper)

    expect(authenticationHandlerMock.lastUserValidationQueryArgs.length).toBe(3)
    expect(authenticationHandlerMock.lastUserValidationQueryArgs[1].user).toBe('wolfram')
    expect(services.logger.lastLogMessage.indexOf('wolfram')).not.toBe(-1)
  })

  describe('the connection endpoint emits a client events for user with name', () => {
    beforeEach(() => {
      uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)
    })

    it('client has the correct connection data', () => {
      expect(handshakeData.remoteAddress).toBe('127.0.0.1')
      expect(handshakeData.headers).toBeDefined()
    })

    it('emits connected event for user with name', done => {
      connectionEndpoint.once('client-connected', socketWrapper => {
        expect(socketWrapper.user).toBe('test-user')
        done()
      })
      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
    })

    it('emits disconnected event for user with name', done => {
      connectionEndpoint.once('client-disconnected', socketWrapper => {
        expect(socketWrapper.user).toBe('test-user')
        done()
      })

      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
      client.socketWrapper.close()
    })
  })

  describe('the connection endpoint doesn\'t emit client events for user without a name', () => {
    beforeEach(() => {
      authenticationHandlerMock.nextUserIsAnonymous = true
      authenticationHandlerMock.nextUserValidationResult = true
      uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)
    })

    it('does not emit connected event', () => {
      const spy = jasmine.createSpy('client-connected')
      connectionEndpoint.once('client-connected', spy)

      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)

      expect(spy).not.toHaveBeenCalled()
    })

    it('does not emit disconnected event', () => {
      authenticationHandlerMock.nextUserIsAnonymous = true
      const spy = jasmine.createSpy('client-disconnected')

      connectionEndpoint.once('client-disconnected', spy)

      uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
      client.socketWrapper.close()

      expect(spy).not.toHaveBeenCalled()
    })
  })

  it('disconnects if the number of invalid authentication attempts is exceeded', () => {
    authenticationHandlerMock.nextUserValidationResult = false
    config.maxAuthAttempts = 3
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendMessage')
      .thrice()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        parsedData: 'Invalid User',
        action: C.AUTH_ACTIONS.AUTH_UNSUCCESSFUL,
      })

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        action: C.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS,
      })

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
  })

  it('disconnects client if authentication timeout is exceeded', done => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.CONNECTION,
        action: C.CONNECTION_ACTIONS.AUTHENTICATION_TIMEOUT,
      })

    client.socketWrapperMock
      .expects('destroy')
      .once()
      .withExactArgs()

    setTimeout(done, 150)
  })

  xit('authenticates valid sockets', () => {
    authenticationHandlerMock.nextUserValidationResult = true

    client.socketWrapperMock
      .expects('destroy')
      .never()

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        action: C.AUTH_ACTIONS.AUTH_SUCCESSFUL,
        // parsedData: undefined
      })

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
  })

  it('notifies the permissionHandler when a client disconnects', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)

    client.socketWrapper.close()

    expect(authenticationHandlerMock.onClientDisconnectCalledWith).toBe('test-user')
  })

  it('routes valid auth messages to the permissionHandler', () => {
    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.EVENT, action: C.EVENT_ACTIONS.EMIT, data: 'test' }], client.socketWrapper)

    const result = { topic: C.TOPIC.EVENT, action: C.EVENT_ACTIONS.EMIT, data: 'test' }
    expect(lastAuthenticatedMessage).toEqual(result as any)
  })

  it('forwards additional data for positive authentications', () => {
    authenticationHandlerMock.nextUserValidationResult = true
    authenticationHandlerMock.sendNextValidAuthWithData = true

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.AUTH,
        action: C.AUTH_ACTIONS.AUTH_SUCCESSFUL,
        parsedData: 'test-data'
      })

    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
  })

  it('connection endpoint doesn\'t log credentials if logInvalidAuthData is set to false', () => {
    config.logInvalidAuthData = false
    authenticationHandlerMock.nextUserValidationResult = false

    uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE, data: '' }], client.socketWrapper)
    uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)

    expect(services.logger.lastLogMessage.indexOf('wolfram')).toBe(-1)
  })
})
