"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const events_1 = require("events");
const sinon = require('sinon');
exports.getTestMocks = () => {
    const subscriptionRegistry = {
        subscribe: () => { },
        unsubscribe: () => { },
        sendToSubscribers: () => { },
        setSubscriptionListener: () => { },
        getLocalSubscribers: () => { },
        getAllRemoteServers: () => { },
        setAction: () => { }
    };
    const listenerRegistry = {
        handle: () => { }
    };
    const emitter = new events_1.EventEmitter();
    const stateRegistry = {
        add: () => { },
        remove: () => { },
        on: () => { },
        emit: () => { },
        getAll: () => { }
    };
    stateRegistry.on = emitter.on;
    stateRegistry.emit = emitter.emit;
    const recordHandler = {
        broadcastUpdate: () => { },
        transitionComplete: () => { }
    };
    const subscriptionRegistryMock = sinon.mock(subscriptionRegistry);
    const listenerRegistryMock = sinon.mock(listenerRegistry);
    const stateRegistryMock = sinon.mock(stateRegistry);
    const recordHandlerMock = sinon.mock(recordHandler);
    function getSocketWrapper(user, authData = {}) {
        const socketWrapperEmitter = new events_1.EventEmitter();
        const socketWrapper = {
            authAttempts: 0,
            user,
            authData: authData || {},
            prepareMessage: () => { },
            sendPrepared: () => { },
            finalizeMessage: () => { },
            sendMessage: () => { },
            sendError: () => { },
            sendAckMessage: () => { },
            uuid: Math.random(),
            parseData: message => {
                if (message.parsedData) {
                    return true;
                }
                try {
                    message.parsedData = JSON.parse(message.data);
                    return true;
                }
                catch (e) {
                    return e;
                }
            },
            getMessage: message => message,
            parseMessage: message => message,
            destroy: () => { },
            getHandshakeData: () => ({}),
            close: () => socketWrapper.emit('close', this),
            emit: socketWrapperEmitter.emit,
            on: socketWrapperEmitter.on,
            once: socketWrapperEmitter.once,
            removeListener: socketWrapperEmitter.removeListener,
        };
        return {
            socketWrapper,
            socketWrapperMock: sinon.mock(socketWrapper)
        };
    }
    return {
        subscriptionRegistry,
        listenerRegistry,
        stateRegistry,
        recordHandler,
        subscriptionRegistryMock,
        listenerRegistryMock,
        stateRegistryMock,
        recordHandlerMock,
        getSocketWrapper,
    };
};
//# sourceMappingURL=test-mocks.js.map