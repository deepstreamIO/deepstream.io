"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const message_distributor_1 = require("../../src/message/message-distributor");
const testHelper = require('../test-helper/test-helper');
const test_mocks_1 = require("../test-helper/test-mocks");
const options = testHelper.getDeepstreamOptions();
const config = options.config;
const services = options.services;
describe('message connector distributes messages to callbacks', () => {
    let messageDistributor;
    let testMocks;
    let client;
    let testCallback;
    beforeEach(() => {
        testMocks = test_mocks_1.getTestMocks();
        client = testMocks.getSocketWrapper();
        testCallback = jasmine.createSpy('test callback');
        messageDistributor = new message_distributor_1.default(config, services);
    });
    afterEach(() => {
        client.socketWrapperMock.verify();
    });
    it('makes remote connection', () => {
        expect(services.message.lastSubscribedTopic).toBe(null);
        messageDistributor.registerForTopic('someTopic', testCallback);
        expect(services.message.lastSubscribedTopic).toBe('someTopic');
    });
    it('makes local connection', () => {
        messageDistributor.registerForTopic('someTopic', testCallback);
        messageDistributor.distribute(client.socketWrapper, { topic: 'someTopic' });
        expect(testCallback.calls.count()).toEqual(1);
    });
    xit('routes messages from the message connector', () => {
        messageDistributor.registerForTopic('topicB', testCallback);
        services.message.simulateIncomingMessage('topicB', { topic: 'topicB' });
        expect(testCallback.calls.count()).toEqual(1);
    });
    it('only routes matching topics', () => {
        messageDistributor.registerForTopic('aTopic', testCallback);
        messageDistributor.registerForTopic('anotherTopic', testCallback);
        messageDistributor.distribute(client.socketWrapper, { topic: 'aTopic' });
        expect(testCallback.calls.count()).toEqual(1);
    });
    it('throws an error for multiple registrations to the same topic', () => {
        let hasErrored = false;
        try {
            messageDistributor.registerForTopic('someTopic', testCallback);
            messageDistributor.registerForTopic('someTopic', testCallback);
        }
        catch (e) {
            hasErrored = true;
        }
        expect(hasErrored).toBe(true);
    });
});
//# sourceMappingURL=message-distributorSpec.js.map