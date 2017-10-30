"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const C = require("../../src/constants");
const proxyquire = require('proxyquire').noPreserveCache();
const uws_mock_1 = require("../test-mocks/uws-mock");
const http_mock_1 = require("../test-mocks/http-mock");
const logger_mock_1 = require("../test-mocks/logger-mock");
const dependency_initialiser_1 = require("../../src/utils/dependency-initialiser");
const permission_handler_mock_1 = require("../test-mocks/permission-handler-mock");
const authentication_handler_mock_1 = require("../test-mocks/authentication-handler-mock");
const socket_mock_1 = require("../test-mocks/socket-mock");
const test_mocks_1 = require("../test-helper/test-mocks");
const httpMock = new http_mock_1.default();
const httpsMock = new http_mock_1.default();
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer;
httpsMock.createServer = httpsMock.createServer;
let client;
let handshakeData;
const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
    'uws': uws_mock_1.default,
    'http': httpMock,
    'https': httpsMock,
    './socket-wrapper-factory': {
        createSocketWrapper: (options, data) => {
            handshakeData = data;
            client = test_mocks_1.getTestMocks().getSocketWrapper('client');
            return client.socketWrapper;
        }
    }
}).default;
let lastAuthenticatedMessage = null;
let connectionEndpoint;
let authenticationHandlerMock;
let config;
let services;
describe('connection endpoint', () => {
    beforeEach(done => {
        authenticationHandlerMock = new authentication_handler_mock_1.default();
        config = {
            unauthenticatedClientTimeout: null,
            maxAuthAttempts: 3,
            logInvalidAuthData: true,
            heartbeatInterval: 4000
        };
        services = {
            authenticationHandler: authenticationHandlerMock,
            logger: new logger_mock_1.default(),
            permissionHandler: new permission_handler_mock_1.default()
        };
        connectionEndpoint = new ConnectionEndpoint(config, services);
        const depInit = new dependency_initialiser_1.default({ config, services }, config, services, connectionEndpoint, 'connectionEndpoint');
        depInit.on('ready', () => {
            connectionEndpoint.unauthenticatedClientTimeout = 100;
            connectionEndpoint.onMessages();
            connectionEndpoint.onMessages = function (socket, parsedMessages) {
                lastAuthenticatedMessage = parsedMessages[parsedMessages.length - 1];
            };
            connectionEndpoint.server._simulateUpgrade(new socket_mock_1.default());
            expect(uws_mock_1.default.lastUserData).not.toBe(null);
            done();
        });
    });
    afterEach(done => {
        connectionEndpoint.once('close', done);
        connectionEndpoint.close();
        client.socketWrapperMock.verify();
    });
    xit('sets autopings on the websocket server', () => {
        expect(uws_mock_1.default.heartbeatInterval).toBe(config.heartbeatInterval);
        expect(uws_mock_1.default.pingMessage).toBe({
            topic: C.TOPIC.CONNECTION,
            action: C.CONNECTION_ACTIONS.PING
        });
    });
    describe('the connection endpoint handles invalid connection messages', () => {
        it('handles gibberish messages', () => {
            client.socketWrapperMock
                .expects('sendError')
                .once()
                .withExactArgs({
                topic: C.TOPIC.CONNECTION,
            }, C.PARSER_ACTIONS.MESSAGE_PARSE_ERROR, 'gibbeerish');
            client.socketWrapperMock
                .expects('destroy')
                .once()
                .withExactArgs();
            uws_mock_1.default.messageHandler([{ parseError: true, raw: 'gibbeerish' }], client.socketWrapper);
        });
        it('handles invalid connection topic', () => {
            client.socketWrapperMock
                .expects('sendError')
                .once()
                .withExactArgs({
                topic: C.TOPIC.CONNECTION,
            }, C.PARSER_ACTIONS.INVALID_MESSAGE, 'gibbeerish');
            client.socketWrapperMock
                .expects('destroy')
                .never();
            uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, raw: 'gibbeerish' }], client.socketWrapper);
        });
    });
    it('the connection endpoint handles invalid auth messages', () => {
        client.socketWrapperMock
            .expects('sendError')
            .once()
            .withExactArgs({
            topic: C.TOPIC.AUTH,
        }, C.PARSER_ACTIONS.MESSAGE_PARSE_ERROR, 'gibbeerish');
        client.socketWrapperMock
            .expects('destroy')
            .once()
            .withExactArgs();
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ parseError: true, raw: 'gibbeerish' }], client.socketWrapper);
    });
    it('the connection endpoint handles auth null data', () => {
        client.socketWrapperMock
            .expects('sendError')
            .once()
            .withExactArgs({
            topic: C.TOPIC.AUTH,
        }, C.AUTH_ACTIONS.INVALID_MESSAGE_DATA);
        client.socketWrapperMock
            .expects('destroy')
            .once()
            .withExactArgs();
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: 'null' }], client.socketWrapper);
    });
    it('the connection endpoint handles invalid auth json', () => {
        client.socketWrapperMock
            .expects('sendError')
            .once()
            .withExactArgs({
            topic: C.TOPIC.AUTH,
        }, C.AUTH_ACTIONS.INVALID_MESSAGE_DATA);
        client.socketWrapperMock
            .expects('destroy')
            .once()
            .withExactArgs();
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{ invalid }' }], client.socketWrapper);
    });
    it('the connection endpoint does not route invalid auth messages to the permissionHandler', () => {
        client.socketWrapperMock
            .expects('sendError')
            .once()
            .withExactArgs({
            topic: C.TOPIC.AUTH,
            parsedData: 'Invalid User'
        }, C.AUTH_ACTIONS.AUTH_UNSUCCESSFUL);
        expect(authenticationHandlerMock.lastUserValidationQueryArgs).toBe(null);
        authenticationHandlerMock.nextUserValidationResult = false;
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"wolfram"}' }], client.socketWrapper);
        expect(authenticationHandlerMock.lastUserValidationQueryArgs.length).toBe(3);
        expect(authenticationHandlerMock.lastUserValidationQueryArgs[1].user).toBe('wolfram');
        expect(services.logger.lastLogMessage.indexOf('wolfram')).not.toBe(-1);
    });
    describe('the connection endpoint emits a client events for user with name', () => {
        beforeEach(() => {
            uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        });
        it('client has the correct connection data', () => {
            expect(handshakeData.remoteAddress).toBe('127.0.0.1');
            expect(handshakeData.headers).toBeDefined();
        });
        it('emits connected event for user with name', done => {
            connectionEndpoint.once('client-connected', socketWrapper => {
                expect(socketWrapper.user).toBe('test-user');
                done();
            });
            uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
        });
        it('emits disconnected event for user with name', done => {
            connectionEndpoint.once('client-disconnected', socketWrapper => {
                expect(socketWrapper.user).toBe('test-user');
                done();
            });
            uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
            client.socketWrapper.close();
        });
    });
    describe('the connection endpoint doesn\'t emit client events for user without a name', () => {
        beforeEach(() => {
            authenticationHandlerMock.nextUserIsAnonymous = true;
            authenticationHandlerMock.nextUserValidationResult = true;
            uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        });
        it('does not emit connected event', () => {
            const spy = jasmine.createSpy('client-connected');
            connectionEndpoint.once('client-connected', spy);
            uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
            expect(spy).not.toHaveBeenCalled();
        });
        it('does not emit disconnected event', () => {
            authenticationHandlerMock.nextUserIsAnonymous = true;
            const spy = jasmine.createSpy('client-disconnected');
            connectionEndpoint.once('client-disconnected', spy);
            uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
            client.socketWrapper.close();
            expect(spy).not.toHaveBeenCalled();
        });
    });
    it('disconnects if the number of invalid authentication attempts is exceeded', () => {
        authenticationHandlerMock.nextUserValidationResult = false;
        config.maxAuthAttempts = 3;
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        client.socketWrapperMock
            .expects('sendError')
            .thrice()
            .withExactArgs({
            topic: C.TOPIC.AUTH,
            parsedData: 'Invalid User'
        }, C.AUTH_ACTIONS.AUTH_UNSUCCESSFUL);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
        client.socketWrapperMock
            .expects('sendError')
            .once()
            .withExactArgs({
            topic: C.TOPIC.AUTH
        }, C.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS);
        client.socketWrapperMock
            .expects('destroy')
            .once()
            .withExactArgs();
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
    });
    it('disconnects client if authentication timeout is exceeded', done => {
        client.socketWrapperMock
            .expects('sendError')
            .once()
            .withExactArgs({
            topic: C.TOPIC.CONNECTION
        }, C.CONNECTION_ACTIONS.CONNECTION_AUTHENTICATION_TIMEOUT);
        client.socketWrapperMock
            .expects('destroy')
            .once()
            .withExactArgs();
        setTimeout(done, 150);
    });
    xit('authenticates valid sockets', () => {
        authenticationHandlerMock.nextUserValidationResult = true;
        client.socketWrapperMock
            .expects('sendError')
            .never();
        client.socketWrapperMock
            .expects('destroy')
            .never();
        client.socketWrapperMock
            .expects('sendMessage')
            .once()
            .withExactArgs({
            topic: C.TOPIC.AUTH,
            action: C.AUTH_ACTIONS.AUTH_SUCCESSFUL,
        });
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
    });
    it('notifies the permissionHandler when a client disconnects', () => {
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
        client.socketWrapper.close();
        expect(authenticationHandlerMock.onClientDisconnectCalledWith).toBe('test-user');
    });
    it('routes valid auth messages to the permissionHandler', () => {
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.EVENT, action: C.EVENT_ACTIONS.EMIT, data: 'test' }], client.socketWrapper);
        const result = { topic: C.TOPIC.EVENT, action: C.EVENT_ACTIONS.EMIT, data: 'test' };
        expect(lastAuthenticatedMessage).toEqual(result);
    });
    it('forwards additional data for positive authentications', () => {
        authenticationHandlerMock.nextUserValidationResult = true;
        authenticationHandlerMock.sendNextValidAuthWithData = true;
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        client.socketWrapperMock
            .expects('sendMessage')
            .once()
            .withExactArgs({
            topic: C.TOPIC.AUTH,
            action: C.AUTH_ACTIONS.AUTH_SUCCESSFUL,
            parsedData: 'test-data'
        });
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
    });
    it('connection endpoint doesn\'t log credentials if logInvalidAuthData is set to false', () => {
        config.logInvalidAuthData = false;
        authenticationHandlerMock.nextUserValidationResult = false;
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.CONNECTION, action: C.CONNECTION_ACTIONS.CHALLENGE_RESPONSE, data: '' }], client.socketWrapper);
        uws_mock_1.default.messageHandler([{ topic: C.TOPIC.AUTH, action: C.RPC_ACTIONS.REQUEST, data: '{"user":"test-user"}' }], client.socketWrapper);
        expect(services.logger.lastLogMessage.indexOf('wolfram')).toBe(-1);
    });
});
//# sourceMappingURL=connection-endpointSpec.js.map