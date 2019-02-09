import { EventEmitter } from 'events'
const sinon = require('sinon')

export const getTestMocks = () => {

  const subscriptionRegistry = {
    subscribe: () => {},
    unsubscribe: () => {},
    sendToSubscribers: () => {},
    setSubscriptionListener: () => {},
    getLocalSubscribers: () => {},
    getAllRemoteServers: () => {},
    setAction: () => {}
  }

  const listenerRegistry = {
    handle: () => {}
  }

  const emitter = new EventEmitter()
  const stateRegistry = {
    add: () => {},
    remove: () => {},
    on: () => {},
    emit: () => {},
    getAll: () => {}
  }
  stateRegistry.on = emitter.on as any
  stateRegistry.emit = emitter.emit as any

  const recordHandler = {
    broadcastUpdate: () => {},
    transitionComplete: () => {}
  }

  const subscriptionRegistryMock = sinon.mock(subscriptionRegistry)
  const listenerRegistryMock = sinon.mock(listenerRegistry)
  const stateRegistryMock = sinon.mock(stateRegistry)
  const recordHandlerMock = sinon.mock(recordHandler)

  function getSocketWrapper (user, authData = {}, clientData = {}) {
    const socketWrapperEmitter = new EventEmitter()
    const socketWrapper = {
      authAttempts: 0,
      user,
      authData,
      clientData,
      sendNativeMessage: () => {},
      sendMessage: () => {},
      sendAckMessage: () => {},
      uuid: Math.random(),
      parseData: message => {
        if (message.parsedData) {
          return true
        }
        try {
          message.parsedData = JSON.parse(message.data)
          return true
        } catch (e) {
          return e
        }
      },
      getMessage: message => message,
      parseMessage: message => message,
      destroy: () => {},
      getHandshakeData: () => ({}),
      close: () => socketWrapper.emit('close', this),
      emit: socketWrapperEmitter.emit,
      on: socketWrapperEmitter.on,
      once: socketWrapperEmitter.once,
      removeListener: socketWrapperEmitter.removeListener,
    }

    return {
      socketWrapper,
      socketWrapperMock: sinon.mock(socketWrapper)
    }
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
  }
}
