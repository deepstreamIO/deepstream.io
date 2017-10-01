const sinon = require('sinon')
const EventEmitter = require('events').EventEmitter

module.exports = () => {

  const subscriptionRegistry = {
    subscribe: () => {},
    unsubscribe: () => {},
    sendToSubscribers: () => {},
    setSubscriptionListener: () => {},
    getLocalSubscribers: () => {},
    getAllRemoteServers: () => {}
  }

  const listenerRegistry = {
    handle: () => {}
  }

  const emitter = new EventEmitter()
  const stateRegistry = {
    add: () => {},
    remove: () => {},
    on: () => {},
    getAll: () => {}
  }
  stateRegistry.on = emitter.on
  stateRegistry.emit = emitter.emit


  const recordHandler = {
    _$broadcastUpdate: () => {},
    _$transitionComplete: () => {}
  }

  const subscriptionRegistryMock = sinon.mock(subscriptionRegistry)
  const listenerRegistryMock = sinon.mock(listenerRegistry)
  const stateRegistryMock = sinon.mock(stateRegistry)
  const recordHandlerMock = sinon.mock(recordHandler)

  function getSocketWrapper (user, authData) {
    const socketWrapperEmitter = new EventEmitter()
    const socketWrapper = {
      user,
      authData: authData || {},
      sendMessage: () => {},
      sendError: () => {},
      sendAckMessage: () => {},
      uuid: Math.random(),
      parseData: message => message.parsedData
    }
    socketWrapper.on = socketWrapperEmitter.on
    socketWrapper.once = socketWrapperEmitter.once
    socketWrapper.emit = socketWrapperEmitter.emit
    socketWrapper.removeListener = socketWrapperEmitter.removeListener

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

