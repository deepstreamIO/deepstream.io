'use strict'

const sinon = require('sinon')
const EventEmitter = require('events').EventEmitter

module.exports = () => {

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
    getAll: () => {}
  }
  stateRegistry.on = emitter.on
  stateRegistry.emit = emitter.emit


  const recordHandler = {
    broadcastUpdate: () => {},
    transitionComplete: () => {}
  }

  const subscriptionRegistryMock = sinon.mock(subscriptionRegistry)
  const listenerRegistryMock = sinon.mock(listenerRegistry)
  const stateRegistryMock = sinon.mock(stateRegistry)
  const recordHandlerMock = sinon.mock(recordHandler)

  function getSocketWrapper (user, authData) {
    const socketWrapperEmitter = new EventEmitter()
    const socketWrapper = {
      authAttempts: 0,
      user,
      authData: authData || {},
      prepareMessage: () => {},
      sendPrepared: () => {},
      finalizeMessage: () => {},
      sendMessage: () => {},
      sendError: () => {},
      sendAckMessage: () => {},
      uuid: Math.random(),
      parseData: (message) => {
        if (message.parsedData) return true
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
      close: () => socketWrapper.emit('close', this)
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

