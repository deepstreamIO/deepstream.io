// import * as C from '../../src/constants'
// const proxyquire = require('proxyquire').noPreserveCache()
// import uwsMock from '../test-mocks/uws-mock'
// import HttpMock from '../test-mocks/http-mock'
// import LoggerMock from '../test-mocks/logger-mock'
// import DependencyInitialiser from '../../src/utils/dependency-initialiser'
// import PermissionHandlerMock from '../test-mocks/permission-handler-mock'
// import AuthenticationHandlerMock from '../test-mocks/authentication-handler-mock'
// import SocketMock from '../test-mocks/socket-mock'
//
// import { getTestMocks } from '../test-helper/test-mocks'
//
// const httpMock = new HttpMock()
// const httpsMock = new HttpMock()
// // since proxyquire.callThru is enabled, manually capture members from prototypes
// httpMock.createServer = httpMock.createServer
// httpsMock.createServer = httpsMock.createServer
//
// let client
// let handshakeData
//
// const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
//   'uws': uwsMock,
//   'http': httpMock,
//   'https': httpsMock,
//   './socket-wrapper-factory': {
//     createSocketWrapper: (options, data) => {
//       handshakeData = data
//       client = getTestMocks().getSocketWrapper('client')
//       return client.socketWrapper
//     }
//   }
// }).default
//
// let lastAuthenticatedMessage = null
// let connectionEndpoint
//
// let authenticationHandlerMock
// let config
// let services
//
// describe.skip('connection endpoint', () => {
//   beforeEach(done => {
//     authenticationHandlerMock = new AuthenticationHandlerMock()
//
//     config = {
//       unauthenticatedClientTimeout: null,
//       maxAuthAttempts: 3,
//       logInvalidAuthData: true,
//       heartbeatInterval: 4000
//     }
//
//     services = {
//       authenticationHandler: authenticationHandlerMock,
//       logger: new LoggerMock(),
//       permission: new PermissionHandlerMock()
//     }
//
//     connectionEndpoint = new ConnectionEndpoint(config, services)
//     const depInit = new DependencyInitialiser({ config, services }, config, services, connectionEndpoint, 'connectionEndpoint')
//     depInit.on('ready', () => {
//       connectionEndpoint.unauthenticatedClientTimeout = 100
//       connectionEndpoint.onMessages()
//       connectionEndpoint.onMessages = function (socket, parsedMessages) {
//         lastAuthenticatedMessage = parsedMessages[parsedMessages.length - 1]
//       }
//       connectionEndpoint.server._simulateUpgrade(new SocketMock())
//       expect(uwsMock.lastUserData).not.to.equal(null)
//       done()
//     })
//   })
//
//   afterEach(done => {
//     connectionEndpoint.once('close', done)
//     connectionEndpoint.close()
//     client.socketWrapperMock.verify()
//   })
//
//   it.skip('sets autopings on the websocket server', () => {
//     expect(uwsMock.heartbeatInterval).to.equal(config.heartbeatInterval)
//     expect(uwsMock.pingMessage).to.equal({
//       topic: C.TOPIC.CONNECTION,
//       action: CONNECTION_ACTION.PING
//     })
//   })
//
//   describe('the connection endpoint handles invalid connection messages', () => {
//     it('handles invalid connection topic', () => {
//       client.socketWrapperMock
//         .expects('sendMessage')
//         .once()
//         .withExactArgs({
//           topic: C.TOPIC.CONNECTION,
//           action: CONNECTION_ACTION.INVALID_MESSAGE,
//           originalTopic: C.TOPIC.AUTH,
//           originalAction: AUTH_ACTION.AUTH_UNSUCCESSFUL,
//           data: 'gibbeerish'
//         })
//
//       client.socketWrapperMock
//         .expects('destroy')
//         .never()
//       const message: C.Message = {
//         topic: C.TOPIC.AUTH,
//         action: AUTH_ACTION.AUTH_UNSUCCESSFUL,
//         raw: 'gibbeerish'
//       }
//       uwsMock.messageHandler([message], client.socketWrapper)
//     })
//   })
//
//   it('the connection endpoint handles parser errors', () => {
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.PARSER,
//         action: C.PARSER_ACTION.UNKNOWN_ACTION,
//         data: Buffer.from('gibbeerish'),
//         originalTopic: 5,
//         originalAction: 177
//       })
//
//     client.socketWrapperMock
//       .expects('destroy')
//       .withExactArgs()
//
//     const message: C.ParseError = {
//       parseError: true,
//       action: C.PARSER_ACTION.UNKNOWN_ACTION,
//       parsedMessage: {
//         topic: 5,
//         action: 177
//       },
//       description: 'unknown RECORD action 177',
//       raw: Buffer.from('gibbeerish')
//     }
//     uwsMock.messageHandler([message], client.socketWrapper)
//   })
//
//   it('the connection endpoint handles invalid auth messages', () => {
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         action: AUTH_ACTION.INVALID_MESSAGE,
//         originalTopic: C.TOPIC.EVENT,
//         originalAction: C.EVENT_ACTION.EMIT,
//         data: 'gibbeerish'
//       })
//
//     client.socketWrapperMock
//       .expects('destroy')
//       .never()
//
//     const message: C.Message = {
//       topic: C.TOPIC.EVENT,
//       action: C.EVENT_ACTION.EMIT,
//       raw: 'gibbeerish'
//     }
//     uwsMock.messageHandler([message], client.socketWrapper)
//   })
//
//   it('the connection endpoint handles auth null data', () => {
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         action: AUTH_ACTION.INVALID_MESSAGE_DATA,
//         originalAction: C.RPC_ACTION.REQUEST,
//       })
//
//     client.socketWrapperMock
//       .expects('destroy')
//       .once()
//       .withExactArgs()
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: 'null' }], client.socketWrapper)
//   })
//
//   it('the connection endpoint handles invalid auth json', () => {
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         action: AUTH_ACTION.INVALID_MESSAGE_DATA,
//         originalAction: C.RPC_ACTION.REQUEST,
//       })
//
//     client.socketWrapperMock
//       .expects('destroy')
//       .once()
//       .withExactArgs()
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{ invalid }' }], client.socketWrapper)
//   })
//
//   it('the connection endpoint does not route invalid auth messages to the permission', () => {
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         parsedData: 'Invalid User',
//         action: AUTH_ACTION.AUTH_UNSUCCESSFUL,
//       })
//
//     expect(authenticationHandlerMock.lastUserValidationQueryArgs).to.equal(null)
//     authenticationHandlerMock.nextUserValidationResult = false
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"wolfram"}' }], client.socketWrapper)
//
//     expect(authenticationHandlerMock.lastUserValidationQueryArgs.length).to.equal(3)
//     expect(authenticationHandlerMock.lastUserValidationQueryArgs[1].user).to.equal('wolfram')
//     expect(services.logger.lastLogMessage.indexOf('wolfram')).not.to.equal(-1)
//   })
//
//   describe('the connection endpoint emits a client events for user with name', () => {
//     beforeEach(() => {
//       uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//     })
//
//     it('client has the correct connection data', () => {
//       expect(handshakeData.remoteAddress).to.equal('127.0.0.1')
//       expect(handshakeData.headers).to.not.equal(undefined)
//     })
//
//     it('emits connected event for user with name', done => {
//       connectionEndpoint.once('client-connected', socketWrapper => {
//         expect(socketWrapper.user).to.equal('test-user')
//         done()
//       })
//       uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//     })
//
//     it('emits disconnected event for user with name', done => {
//       connectionEndpoint.once('client-disconnected', socketWrapper => {
//         expect(socketWrapper.user).to.equal('test-user')
//         done()
//       })
//
//       uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//       client.socketWrapper.close()
//     })
//   })
//
//   describe('the connection endpoint doesn\'t emit client events for user without a name', () => {
//     beforeEach(() => {
//       authenticationHandlerMock.nextUserIsAnonymous = true
//       authenticationHandlerMock.nextUserValidationResult = true
//       uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//     })
//
//     it('does not emit connected event', () => {
//       const spy = spy()
//       connectionEndpoint.once('client-connected', spy)
//
//       uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//
//       expect(spy).to.have.callCount(0)
//     })
//
//     it('does not emit disconnected event', () => {
//       authenticationHandlerMock.nextUserIsAnonymous = true
//       const spy = spy()
//
//       connectionEndpoint.once('client-disconnected', spy)
//
//       uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//       client.socketWrapper.close()
//
//       expect(spy).to.have.callCount(0)
//     })
//   })
//
//   it('disconnects if the number of invalid authentication attempts is exceeded', () => {
//     authenticationHandlerMock.nextUserValidationResult = false
//     config.maxAuthAttempts = 3
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .thrice()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         parsedData: 'Invalid User',
//         action: AUTH_ACTION.AUTH_UNSUCCESSFUL,
//       })
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         action: AUTH_ACTION.TOO_MANY_AUTH_ATTEMPTS,
//       })
//
//     client.socketWrapperMock
//       .expects('destroy')
//       .once()
//       .withExactArgs()
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//   })
//
//   it('disconnects client if authentication timeout is exceeded', done => {
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.CONNECTION,
//         action: CONNECTION_ACTION.AUTHENTICATION_TIMEOUT,
//       })
//
//     client.socketWrapperMock
//       .expects('destroy')
//       .once()
//       .withExactArgs()
//
//     setTimeout(done, 150)
//   })
//
//   it.skip('authenticates valid sockets', () => {
//     authenticationHandlerMock.nextUserValidationResult = true
//
//     client.socketWrapperMock
//       .expects('destroy')
//       .never()
//
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         action: AUTH_ACTION.AUTH_SUCCESSFUL,
//         // parsedData: undefined
//       })
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//   })
//
//   it('notifies the permission when a client disconnects', () => {
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//
//     client.socketWrapper.close()
//
//     expect(authenticationHandlerMock.onClientDisconnectCalledWith).to.equal('test-user')
//   })
//
//   it('routes valid auth messages to the permission', () => {
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//     uwsMock.messageHandler([{ topic: C.TOPIC.EVENT, action: C.EVENT_ACTION.EMIT, data: 'test' }], client.socketWrapper)
//
//     const result = { topic: C.TOPIC.EVENT, action: C.EVENT_ACTION.EMIT, data: 'test' }
//     expect(lastAuthenticatedMessage).to.deep.equal(result as any)
//   })
//
//   it('forwards additional data for positive authentications', () => {
//     authenticationHandlerMock.nextUserValidationResult = true
//     authenticationHandlerMock.sendNextValidAuthWithData = true
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         action: AUTH_ACTION.AUTH_SUCCESSFUL,
//         parsedData: 'test-data'
//       })
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//   })
//
//   it('connection endpoint doesn\'t log credentials if logInvalidAuthData is set to false', () => {
//     config.logInvalidAuthData = false
//     authenticationHandlerMock.nextUserValidationResult = false
//
//     uwsMock.messageHandler([{ topic: C.TOPIC.CONNECTION, action: CONNECTION_ACTION.CHALLENGE, data: '' }], client.socketWrapper)
//     uwsMock.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTION.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper)
//
//     expect(services.logger.lastLogMessage.indexOf('wolfram')).to.equal(-1)
//   })
// })

// const proxyquire = require('proxyquire').noPreserveCache()
//
// import * as uwsMock from '../test-mocks/uws-mock'
// import HttpMock from '../test-mocks/http-mock'
// import LoggerMock from '../test-mocks/logger-mock'
// import PermissionHandlerMock from '../test-mocks/permission-handler-mock'
//
// const httpMock: any = new HttpMock()
// const httpsMock: any = new HttpMock()
// // since proxyquire.callThru is enabled, manually capture members from prototypes
// httpMock.createServer = httpMock.createServer
// httpsMock.createServer = httpsMock.createServer
// const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
//   uws: uwsMock,
//   http: httpMock,
//   https: httpsMock
// }).default
//
// const config = {
//   maxAuthAttempts: 3,
//   logInvalidAuthData: true
// }
//
// const services = {
//   permission: PermissionHandlerMock,
//   logger: new LoggerMock()
// }
//
// const mockDs = { config, services }
//
// let connectionEndpoint
//
// const connectionEndpointInit = (endpointOptions, onReady) => {
//   connectionEndpoint = new ConnectionEndpoint(endpointOptions)
//   connectionEndpoint.setDeepstream(mockDs)
//   connectionEndpoint.init()
//   connectionEndpoint.on('ready', onReady)
// }
//
// describe('validates HTTPS server conditions', () => {
//   let error
//   let sslOptions
//   connectionEndpoint = null
//
//   before(() => {
//     spyOn(httpMock, 'createServer').and.callThrough()
//     spyOn(httpsMock, 'createServer').and.callThrough()
//   })
//
//   beforeEach(() => {
//     sslOptions = {
//       permission: PermissionHandlerMock,
//       logger: { log () {} }
//     }
//     error = { message: null }
//   })
//
//   afterEach(done => {
//     if (!connectionEndpoint || !connectionEndpoint.isReady) {
//       done()
//     } else {
//       connectionEndpoint.once('close', done)
//       connectionEndpoint.close()
//     }
//
//     httpMock.createServer.resetHistory()
//     httpsMock.createServer.resetHistory()
//   })
//
//   it('creates a http connection when sslKey and sslCert are not provided', done => {
//     connectionEndpointInit(sslOptions, () => {
//       expect(httpMock.createServer).to.have.been.calledWith()
//       expect(httpsMock.createServer).to.have.callCount(0)
//       done()
//     })
//   })
//
//   it('creates a https connection when sslKey and sslCert are provided', done => {
//     sslOptions.sslKey = 'sslPrivateKey'
//     sslOptions.sslCert = 'sslCertificate'
//     connectionEndpointInit(sslOptions, () => {
//       expect(httpMock.createServer).to.have.callCount(0)
//       expect(httpsMock.createServer).to.have.been.calledWith({ key: 'sslPrivateKey', cert: 'sslCertificate', ca: undefined })
//       done()
//     })
//   })
//
//   it('creates a https connection when sslKey, sslCert and sslCa are provided', done => {
//     sslOptions.sslKey = 'sslPrivateKey'
//     sslOptions.sslCert = 'sslCertificate'
//     sslOptions.sslCa = 'sslCertificateAuthority'
//     connectionEndpointInit(sslOptions, () => {
//       expect(httpMock.createServer).to.have.callCount(0)
//       expect(httpsMock.createServer).to.have.been.calledWith({ key: 'sslPrivateKey', cert: 'sslCertificate', ca: 'sslCertificateAuthority' })
//       done()
//     })
//   })
//
//   it('throws an exception when only sslCert is provided', () => {
//     try {
//       sslOptions.sslCert = 'sslCertificate'
//       connectionEndpointInit(sslOptions, () => {})
//     } catch (e) {
//       error = e
//     } finally {
//       expect(error.message).to.equal('Must also include sslKey in order to use SSL')
//     }
//   })
//
//   it('throws an exception when only sslKey is provided', () => {
//     try {
//       sslOptions.sslKey = 'sslPrivateKey'
//       connectionEndpointInit(sslOptions, () => {})
//     } catch (e) {
//       error = e
//     } finally {
//       expect(error.message).to.equal('Must also include sslCertFile in order to use SSL')
//     }
//   })
//
//   it('throws an exception when sslCert and sslCa is provided', () => {
//     try {
//       sslOptions.sslCert = 'sslCertificate'
//       sslOptions.sslCa = 'sslCertificateAuthority'
//       connectionEndpointInit(sslOptions, () => {})
//     } catch (e) {
//       error = e
//     } finally {
//       expect(error.message).to.equal('Must also include sslKey in order to use SSL')
//     }
//   })
//
//   it('throws an exception when sslKey and sslCa is provided', () => {
//     try {
//       sslOptions.sslKey = 'sslPrivateKey'
//       sslOptions.sslCa = 'sslCertificateAuthority'
//       connectionEndpointInit(sslOptions, () => {})
//     } catch (e) {
//       error = e
//     } finally {
//       expect(error.message).to.equal('Must also include sslCertFile in order to use SSL')
//     }
//   })
// })

// import * as C from '../../src/constants'
// const proxyquire = require('proxyquire').noPreserveCache()
// import HttpMock from '../test-mocks/http-mock'
// import LoggerMock from '../test-mocks/logger-mock'
//
// const httpMock = new HttpMock()
// const httpsMock = new HttpMock()
// // since proxyquire.callThru is enabled, manually capture members from prototypes
// httpMock.createServer = httpMock.createServer
// httpsMock.createServer = httpsMock.createServer
//
// import { getTestMocks } from '../test-helper/test-mocks'
//
// let client
//
// const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
//   './socket-wrapper-factory': {
//     createSocketWrapper: () => {
//       client = getTestMocks().getSocketWrapper('client')
//       return client.socketWrapper
//     }
//   }
// }).default
// import DependencyInitialiser from '../../src/utils/dependency-initialiser'
// import SocketMock from '../test-mocks/socket-mock'
//
// const permission = {
//   isValidUser (connectionData, authData, callback) {
//     callback(true, {
//       username: 'someUser',
//       clientData: { firstname: 'Wolfram' },
//       serverData: { role: 'admin' }
//     })
//   },
//   canPerformAction (username, message, callback) {
//     callback(null, true)
//   },
//   onClientDisconnect () {}
// }
//
// const config = {
//   maxAuthAttempts: 3,
//   logInvalidAuthData: true,
//   unauthenticatedClientTimeout: 100
// }
//
// const services = {
//   permission,
//   authenticationHandler: permission,
//   logger: new LoggerMock()
// }
//
// describe('permission passes additional user meta data', () => {
//   let connectionEndpoint
//
//   beforeEach(done => {
//     connectionEndpoint = new ConnectionEndpoint(config)
//     const depInit = new DependencyInitialiser({ config, services }, config as any, services as any, connectionEndpoint, 'connectionEndpoint')
//     depInit.on('ready', () => {
//       connectionEndpoint.onMessages = function () {}
//       connectionEndpoint.server._simulateUpgrade(new SocketMock())
//
//       uwsMock.messageHandler([{
//         topic: C.TOPIC.CONNECTION,
//         action: CONNECTION_ACTION.CHALLENGE,
//         data: 'localhost:6021'
//       }], client.socketWrapper)
//
//       done()
//     })
//   })
//
//   it('sends an authentication message', () => {
//     spyOn(permission, 'isValidUser').and.callThrough()
//
//     client.socketWrapperMock
//       .expects('sendMessage')
//       .once()
//       .withExactArgs({
//         topic: C.TOPIC.AUTH,
//         action: AUTH_ACTION.AUTH_SUCCESSFUL,
//         parsedData: { firstname: 'Wolfram' }
//       })
//
//     uwsMock.messageHandler([{
//       topic: C.TOPIC.AUTH,
//       action: AUTH_ACTION.REQUEST,
//       data: '{ "token": 1234 }'
//     }], client.socketWrapper)
//
//     expect(permission.isValidUser).to.have.callCount(1)
//     expect((permission.isValidUser as any).calls.mostRecent().args[1]).to.deep.equal({ token: 1234 })
//
//     client.socketWrapperMock.verify()
//   })
//
//   it('sends a record read message', () => {
//     spyOn(connectionEndpoint, 'onMessages')
//
//     uwsMock.messageHandler([{
//       topic: C.TOPIC.AUTH,
//       action: AUTH_ACTION.REQUEST,
//       data: '{ "token": 1234 }'
//     }], client.socketWrapper)
//
//     uwsMock.messageHandler([{
//       topic: C.TOPIC.RECORD,
//       action: C.RECORD_ACTION.READ,
//       name: 'recordA'
//     }], client.socketWrapper)
//
//     expect(connectionEndpoint.onMessages).to.have.callCount(1)
//     expect(connectionEndpoint.onMessages.calls.mostRecent().args[0].authData).to.deep.equal({ role: 'admin' })
//   })
// })
