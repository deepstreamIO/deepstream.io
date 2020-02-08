import { EventEmitter } from 'events'
import { Message, JSONObject } from '../../constants'
import { SocketWrapper } from '@deepstream/types'
const sinon = require('sinon')

export const getTestMocks = () => {

  const subscriptionRegistry = {
    subscribe: () => {},
    unsubscribe: () => {},
    sendToSubscribers: () => {},
    setSubscriptionListener: () => {},
    getLocalSubscribers: () => new Set(),
    getAllRemoteServers: () => {},
    setAction: () => {},
    hasLocalSubscribers: () => true,
    subscribeBulk: () => {},
    unsubscribeBulk: () => {}
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
    getAll: () => {},
    onAdd: () => {},
    onRemove: () => {}
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

  function getSocketWrapper (userId: string, authData: JSONObject = {}, clientData: JSONObject = {}) {
    const socketWrapper = {
      authAttempts: 0,
      userId,
      authData,
      clientData,
      sendMessage: () => {},
      sendBuiltMessage: () => {},
      sendAckMessage: () => {},
      uuid: Math.random(),
      parseData: (message: Message) => {
        if (message.parsedData) {
          return true
        }
        try {
          message.parsedData = JSON.parse(message.data!.toString())
          return true
        } catch (e) {
          return e
        }
      },
      getMessage: (message: Message) => message,
      parseMessage: (message: Message) => message,
      destroy: () => {},
      getHandshakeData: () => ({}),
      close: () => {},
      onClose: () => {},
      removeOnClose: () => {}
    } as never as SocketWrapper

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
