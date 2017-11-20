"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const C = require("../../src/constants");
const permission_handler_mock_1 = require("../test-mocks/permission-handler-mock");
const MessageProcessor = require('../../src/message/message-processor').default;
const logger_mock_1 = require("../test-mocks/logger-mock");
const test_mocks_1 = require("../test-helper/test-mocks");
let messageProcessor;
let log;
let lastAuthenticatedMessage = null;
describe('the message processor only forwards valid, authorized messages', () => {
    let testMocks;
    let client;
    let permissionHandlerMock;
    const message = {
        topic: C.TOPIC.RECORD,
        action: C.RECORD_ACTIONS.READ,
        name: 'record/name'
    };
    beforeEach(() => {
        testMocks = test_mocks_1.getTestMocks();
        client = testMocks.getSocketWrapper('someUser');
        permissionHandlerMock = new permission_handler_mock_1.default();
        const loggerMock = new logger_mock_1.default();
        log = loggerMock._log;
        messageProcessor = new MessageProcessor({}, {
            permissionHandler: permissionHandlerMock,
            logger: loggerMock
        });
        messageProcessor.onAuthenticatedMessage = function (socketWrapper, authenticatedMessage) {
            lastAuthenticatedMessage = authenticatedMessage;
        };
    });
    afterEach(() => {
        client.socketWrapperMock.verify();
    });
    it('ignores heartbeats pongs messages', () => {
        client.socketWrapperMock
            .expects('sendMessage')
            .never();
        messageProcessor.process(client.socketWrapper, [{ topic: 'C', action: 'PO' }]);
    });
    it('handles permission errors', () => {
        permissionHandlerMock.nextCanPerformActionResult = 'someError';
        client.socketWrapperMock
            .expects('sendMessage')
            .once()
            .withExactArgs({
            topic: C.TOPIC.RECORD,
            action: C.RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR,
            originalAction: C.RECORD_ACTIONS.READ,
            name: message.name
        });
        messageProcessor.process(client.socketWrapper, [message]);
        expect(log).toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(2, C.RECORD_ACTIONS[C.RECORD_ACTIONS.MESSAGE_PERMISSION_ERROR], 'someError');
    });
    it('rpc permission errors have a correlation id', () => {
        permissionHandlerMock.nextCanPerformActionResult = 'someError';
        const rpcMessage = {
            topic: C.TOPIC.RPC,
            action: C.RPC_ACTIONS.REQUEST,
            name: 'myRPC',
            correlationId: '1234567890',
            data: Buffer.from('{}', 'utf8'),
            parsedData: {}
        };
        client.socketWrapperMock
            .expects('sendMessage')
            .once()
            .withExactArgs({
            topic: C.TOPIC.RPC,
            action: C.RPC_ACTIONS.MESSAGE_PERMISSION_ERROR,
            originalAction: rpcMessage.action,
            name: rpcMessage.name,
            correlationId: rpcMessage.correlationId
        });
        messageProcessor.process(client.socketWrapper, [rpcMessage]);
        expect(log).toHaveBeenCalled();
        expect(log).toHaveBeenCalledWith(2, C.RPC_ACTIONS[C.RPC_ACTIONS.MESSAGE_PERMISSION_ERROR], 'someError');
    });
    it('handles denied messages', () => {
        permissionHandlerMock.nextCanPerformActionResult = false;
        client.socketWrapperMock
            .expects('sendMessage')
            .once()
            .withExactArgs({
            topic: C.TOPIC.RECORD,
            action: C.RECORD_ACTIONS.MESSAGE_DENIED,
            originalAction: C.RECORD_ACTIONS.READ,
            name: message.name
        });
        messageProcessor.process(client.socketWrapper, [message]);
    });
    it('provides the correct arguments to canPerformAction', () => {
        permissionHandlerMock.nextCanPerformActionResult = false;
        messageProcessor.process(client.socketWrapper, [message]);
        expect(permissionHandlerMock.lastCanPerformActionQueryArgs.length).toBe(5);
        expect(permissionHandlerMock.lastCanPerformActionQueryArgs[0]).toBe('someUser');
        expect(permissionHandlerMock.lastCanPerformActionQueryArgs[1].name).toBe('record/name');
        expect(permissionHandlerMock.lastCanPerformActionQueryArgs[3]).toEqual({});
        expect(permissionHandlerMock.lastCanPerformActionQueryArgs[4]).toBe(client.socketWrapper);
    });
    it('forwards validated and permissioned messages', () => {
        permissionHandlerMock.nextCanPerformActionResult = true;
        messageProcessor.process(client.socketWrapper, [message]);
        expect(lastAuthenticatedMessage).toBe(message);
    });
});
//# sourceMappingURL=message-processorSpec.js.map