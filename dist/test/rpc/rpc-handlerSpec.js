"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const C = require("../../src/constants");
const RpcHandler = require('../../src/rpc/rpc-handler').default;
const testHelper = require('../test-helper/test-helper');
const test_mocks_1 = require("../test-helper/test-mocks");
const options = testHelper.getDeepstreamOptions();
const config = options.config;
const services = options.services;
describe('the rpcHandler routes events correctly', () => {
    let testMocks;
    let rpcHandler;
    let requestor;
    let provider;
    beforeEach(() => {
        testMocks = test_mocks_1.getTestMocks();
        rpcHandler = new RpcHandler(config, services, testMocks.subscriptionRegistry);
        requestor = testMocks.getSocketWrapper('requestor');
        provider = testMocks.getSocketWrapper('provider');
    });
    afterEach(() => {
        testMocks.subscriptionRegistryMock.verify();
        requestor.socketWrapperMock.verify();
        provider.socketWrapperMock.verify();
    });
    it('routes subscription messages', () => {
        const subscriptionMessage = {
            topic: C.TOPIC.RPC,
            action: C.RPC_ACTIONS.PROVIDE,
            name: 'someRPC'
        };
        testMocks.subscriptionRegistryMock
            .expects('subscribe')
            .once()
            .withExactArgs(subscriptionMessage, provider.socketWrapper);
        rpcHandler.handle(provider.socketWrapper, subscriptionMessage);
    });
    describe('when recieving a request', () => {
        const requestMessage = {
            topic: C.TOPIC.RPC,
            action: C.RPC_ACTIONS.REQUEST,
            name: 'addTwo',
            correlationId: 1234,
            data: '{"numA":5, "numB":7}'
        };
        const acceptMessage = {
            topic: C.TOPIC.RPC,
            action: C.RPC_ACTIONS.ACCEPT,
            name: 'addTwo',
            correlationId: 1234
        };
        const responseMessage = {
            topic: C.TOPIC.RPC,
            action: C.RPC_ACTIONS.RESPONSE,
            name: 'addTwo',
            correlationId: 1234,
            data: '12'
        };
        const errorMessage = {
            topic: C.TOPIC.RPC,
            action: C.RPC_ACTIONS.ERROR,
            isError: true,
            name: 'addTwo',
            correlationId: 1234,
            data: 'ErrorOccured'
        };
        beforeEach(() => {
            testMocks.subscriptionRegistryMock
                .expects('getLocalSubscribers')
                .once()
                .withExactArgs('addTwo')
                .returns([provider.socketWrapper]);
        });
        it('forwards it to a provider', () => {
            provider.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs(requestMessage);
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
        });
        it('accepts first accept', () => {
            requestor.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs(acceptMessage);
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, acceptMessage);
        });
        it('errors when recieving more than one ack', () => {
            provider.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs({
                topic: C.TOPIC.RPC,
                action: C.RPC_ACTIONS.MULTIPLE_ACCEPT,
                name: requestMessage.name,
                correlationId: requestMessage.correlationId
            });
            provider.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs(requestMessage);
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, acceptMessage);
            rpcHandler.handle(provider.socketWrapper, acceptMessage);
        });
        it('gets a response', () => {
            requestor.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs(responseMessage);
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, responseMessage);
        });
        it('replies with an error to additonal responses', () => {
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, responseMessage);
            provider.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs({
                topic: C.TOPIC.RPC,
                action: C.RPC_ACTIONS.INVALID_RPC_CORRELATION_ID,
                originalAction: responseMessage.action,
                name: responseMessage.name,
                correlationId: responseMessage.correlationId
            });
            rpcHandler.handle(provider.socketWrapper, responseMessage);
        });
        it('gets an error', () => {
            requestor.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs(errorMessage);
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, errorMessage);
        });
        it('replies with an error after the first message', () => {
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, errorMessage);
            provider.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs({
                topic: C.TOPIC.RPC,
                action: C.RPC_ACTIONS.INVALID_RPC_CORRELATION_ID,
                originalAction: errorMessage.action,
                name: errorMessage.name,
                correlationId: errorMessage.correlationId
            });
            rpcHandler.handle(provider.socketWrapper, errorMessage);
        });
        it('supports multiple RPCs in quick succession', () => {
            testMocks.subscriptionRegistryMock
                .expects('getLocalSubscribers')
                .exactly(49)
                .withExactArgs('addTwo')
                .returns([provider.socketWrapper]);
            expect(() => {
                for (let i = 0; i < 50; i++) {
                    rpcHandler.handle(requestor.socketWrapper, requestMessage);
                }
            }).not.toThrow();
        });
        it('times out if no ack is received', done => {
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            requestor.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs({
                topic: C.TOPIC.RPC,
                action: C.RPC_ACTIONS.ACCEPT_TIMEOUT,
                name: requestMessage.name,
                correlationId: requestMessage.correlationId
            });
            setTimeout(() => {
                done();
            }, config.rpcAckTimeout * 2);
        });
        it('times out if response is not received in time', done => {
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, acceptMessage);
            requestor.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs({
                topic: C.TOPIC.RPC,
                action: C.RPC_ACTIONS.RESPONSE_TIMEOUT,
                name: requestMessage.name,
                correlationId: requestMessage.correlationId
            });
            setTimeout(done, config.rpcTimeout + 2);
        });
        // Should an Ack for a non existant rpc should error?
        xit('ignores ack message if it arrives after response', done => {
            provider.socketWrapperMock
                .expects('sendMessage')
                .twice();
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, responseMessage);
            setTimeout(() => {
                rpcHandler.handle(provider.socketWrapper, acceptMessage);
                done();
            }, 30);
        });
        it('doesn\'t throw error on response after timeout', done => {
            rpcHandler.handle(requestor.socketWrapper, requestMessage);
            rpcHandler.handle(provider.socketWrapper, acceptMessage);
            requestor.socketWrapperMock
                .expects('sendMessage')
                .once()
                .withExactArgs({
                topic: C.TOPIC.RPC,
                action: C.RPC_ACTIONS.RESPONSE_TIMEOUT,
                name: requestMessage.name,
                correlationId: requestMessage.correlationId
            });
            setTimeout(() => {
                provider.socketWrapperMock
                    .expects('sendMessage')
                    .once()
                    .withExactArgs({
                    topic: C.TOPIC.RPC,
                    action: C.RPC_ACTIONS.INVALID_RPC_CORRELATION_ID,
                    originalAction: responseMessage.action,
                    name: responseMessage.name,
                    correlationId: responseMessage.correlationId
                });
                rpcHandler.handle(provider.socketWrapper, responseMessage);
                done();
            }, 30);
        });
    });
});
//# sourceMappingURL=rpc-handlerSpec.js.map