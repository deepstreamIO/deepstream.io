/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const RpcHandler = require('../../src/rpc/rpc-handler')
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const C = require('../../src/constants/constants')
const testHelper = require('../test-helper/test-helper')
const SocketMock = require('../mocks/socket-mock')

const _msg = testHelper.msg
const options = testHelper.getDeepstreamOptions()
const rpcHandler = new RpcHandler(options)
const subscriptionMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.SUBSCRIBE,
  raw: 'rawMessageString',
  data: ['addTwo']
}
const requestMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.REQUEST,
  raw: _msg('P|REQ|addTwo|1234|{"numA":5, "numB":7}+'),
  data: ['addTwo', '1234', '{"numA":5, "numB":7}']
}
const ackMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.ACK,
  raw: _msg('P|A|REQ|addTwo|1234+'),
  data: ['REQ', 'addTwo', '1234']
}
const errorMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.ERROR,
  raw: _msg('P|E|ErrorOccured|addTwo|1234+'),
  data: ['ErrorOccured', 'addTwo', '1234']
}
const responseMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.RESPONSE,
  raw: _msg('P|RES|addTwo|1234|12+'),
  data: ['addTwo', '1234', '12']
}
const additionalResponseMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.RESPONSE,
  raw: _msg('P|RES|addTwo|1234|14+'),
  data: ['addTwo', '1234', '14']
}
const remoteRequestMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.REQUEST,
  raw: _msg('P|REQ|substract|44|{"numA":8, "numB":3}+'),
  data: ['substract', '4', '{"numA":8, "numB":3}']
}
const privateRemoteAckMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.ACK,
  raw: _msg('P|A|REQ|substract|4+'),
  data: ['REQ', 'substract', '4']
}
const privateRemoteAckMessageUnknown = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.ACK,
  raw: _msg('P|A|REQ|substract|4+'),
  originalTopic: C.TOPIC.RPC,
  data: ['REQ', 'substract', '5']
}
const privateRemoteResponseMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.RESPONSE,
  raw: _msg('P|RES|substract|4|5+'),
  originalTopic: C.TOPIC.RPC,
  data: ['substract', '4', '5']
}

describe('the rpc handler', () => {
  describe('routes remote procedure call related messages', () => {

    it('sends an error for subscription messages without data', () => {
      const socketWrapper = new SocketWrapper(new SocketMock(), {})
      const invalidMessage = {
        topic: C.TOPIC.RPC,
        action: C.ACTIONS.SUBSCRIBE,
        raw: 'rawMessageString1'
      }

      rpcHandler.handle(socketWrapper, invalidMessage)
      expect(socketWrapper.socket.lastSendMessage).toBe(_msg('P|E|INVALID_MESSAGE_DATA|rawMessageString1+'))
    })

    it('sends an error for invalid subscription messages ', () => {
      const socketWrapper = new SocketWrapper(new SocketMock(), {})
      const invalidMessage = {
        topic: C.TOPIC.RPC,
        action: C.ACTIONS.SUBSCRIBE,
        raw: 'rawMessageString2',
        data: [1, 'a']
      }

      rpcHandler.handle(socketWrapper, invalidMessage)
      expect(socketWrapper.socket.lastSendMessage).toBe(_msg('P|E|INVALID_MESSAGE_DATA|rawMessageString2+'))
    })

    it('sends an error for unknown actions', () => {
      const socketWrapper = new SocketWrapper(new SocketMock(), {})
      const invalidMessage = {
        topic: C.TOPIC.RPC,
        action: 'giberrish',
        raw: 'rawMessageString2',
        data: [1, 'a']
      }

      rpcHandler.handle(socketWrapper, invalidMessage)
      expect(socketWrapper.socket.lastSendMessage).toBe(_msg('P|E|UNKNOWN_ACTION|unknown action giberrish+'))
    })

    it('routes subscription messages', () => {
      const socketWrapper = new SocketWrapper(new SocketMock(), {})
      rpcHandler.handle(socketWrapper, subscriptionMessage)
      expect(socketWrapper.socket.lastSendMessage).toBe(_msg('P|A|S|addTwo+'))

      subscriptionMessage.action = C.ACTIONS.UNSUBSCRIBE
      rpcHandler.handle(socketWrapper, subscriptionMessage)
      expect(socketWrapper.socket.lastSendMessage).toBe(_msg('P|A|US|addTwo+'))
    })

    it('executes local rpcs', () => {
      const requestor = new SocketWrapper(new SocketMock(), {})
      const provider = new SocketWrapper(new SocketMock(), {})

      // Register provider
      subscriptionMessage.action = C.ACTIONS.SUBSCRIBE
      rpcHandler.handle(provider, subscriptionMessage)
      expect(provider.socket.lastSendMessage).toBe(_msg('P|A|S|addTwo+'))

      // Issue Rpc
      rpcHandler.handle(requestor, requestMessage)
      expect(requestor.socket.lastSendMessage).toBeNull()
      expect(provider.socket.lastSendMessage).toBe(_msg('P|REQ|addTwo|1234|{"numA":5, "numB":7}+'))

      // Return Ack
      rpcHandler.handle(provider, ackMessage)
      expect(requestor.socket.lastSendMessage).toBe(_msg('P|A|REQ|addTwo|1234+'))

      // Sends error for additional acks
      requestor.socket.lastSendMessage = null
      rpcHandler.handle(provider, ackMessage)
      expect(requestor.socket.lastSendMessage).toBeNull()
      expect(provider.socket.lastSendMessage).toBe(_msg('P|E|MULTIPLE_ACK|addTwo|1234+'))

      // Return Response
      rpcHandler.handle(provider, responseMessage)
      expect(requestor.socket.lastSendMessage).toBe(_msg('P|RES|addTwo|1234|12+'))

      // Unregister Subscriber
      subscriptionMessage.action = C.ACTIONS.UNSUBSCRIBE
      rpcHandler.handle(provider, subscriptionMessage)
      expect(provider.socket.lastSendMessage).toBe(_msg('P|A|US|addTwo+'))

      // Ignores additional responses
      requestor.socket.lastSendMessage = null
      provider.socket.lastSendMessage = null
      rpcHandler.handle(provider, additionalResponseMessage)
      expect(requestor.socket.lastSendMessage).toBeNull()
      expect(provider.socket.lastSendMessage).toBe(_msg('P|E|INVALID_RPC_CORRELATION_ID|unexpected state for rpc addTwo with action RES+'))
    })

    it('executes local rpcs - error scenario', () => {
      const requestor = new SocketWrapper(new SocketMock(), {})
      const provider = new SocketWrapper(new SocketMock(), {})

      // Register provider
      subscriptionMessage.action = C.ACTIONS.SUBSCRIBE
      rpcHandler.handle(provider, subscriptionMessage)

      // Issue Rpc
      rpcHandler.handle(requestor, requestMessage)

      // Error Response
      requestor.socket.lastSendMessage = null

      rpcHandler.handle(provider, errorMessage)

      expect(requestor.socket.lastSendMessage).toBe(_msg('P|E|ErrorOccured|addTwo|1234+'))

      // Ignores additional responses
      requestor.socket.lastSendMessage = null
      provider.socket.lastSendMessage = null
      rpcHandler.handle(provider, errorMessage)
      expect(requestor.socket.lastSendMessage).toBeNull()
      expect(provider.socket.lastSendMessage).toBe(_msg('P|E|INVALID_RPC_CORRELATION_ID|unexpected state for rpc addTwo with action E+'))
    })

    it('supports multiple RPCs in quick succession', () => {
      const requestor = new SocketWrapper(new SocketMock(), {})
      const provider = new SocketWrapper(new SocketMock(), {})

      // Register provider
      subscriptionMessage.action = C.ACTIONS.SUBSCRIBE
      rpcHandler.handle(provider, subscriptionMessage)
      expect(provider.socket.lastSendMessage).toBe(_msg('P|A|S|addTwo+'))

      expect(() => {
        for (let i = 0; i < 50; i++) {
          rpcHandler.handle(requestor, requestMessage)
        }
      }).not.toThrow()
    })
  })

  it('ignores ack message if it arrives after response', () => {
    const requestor = new SocketWrapper(new SocketMock(), {})
    const provider = new SocketWrapper(new SocketMock(), {})

      // Register provider
    subscriptionMessage.action = C.ACTIONS.SUBSCRIBE
    rpcHandler.handle(provider, subscriptionMessage)
    expect(provider.socket.lastSendMessage).toBe(_msg('P|A|S|addTwo+'))

      // Issue Rpc
    rpcHandler.handle(requestor, requestMessage)

      // Response
    rpcHandler.handle(provider, responseMessage)
    expect(requestor.socket.lastSendMessage).toBe(_msg('P|RES|addTwo|1234|12+'))

      // Ack is ignored
    rpcHandler.handle(provider, ackMessage)
    expect(requestor.socket.lastSendMessage).toBe(_msg('P|RES|addTwo|1234|12+'))
  })

  it('ignores multiple responses', () => {
    const requestor = new SocketWrapper(new SocketMock(), {})
    const provider = new SocketWrapper(new SocketMock(), {})

      // Register provider
    subscriptionMessage.action = C.ACTIONS.SUBSCRIBE
    rpcHandler.handle(provider, subscriptionMessage)
    expect(provider.socket.lastSendMessage).toBe(_msg('P|A|S|addTwo+'))

      // Issue Rpc
    rpcHandler.handle(requestor, requestMessage)

      // Response
    rpcHandler.handle(provider, responseMessage)
    expect(requestor.socket.lastSendMessage).toBe(_msg('P|RES|addTwo|1234|12+'))

    requestor.socket.lastSendMessage = null
      // Another response
    rpcHandler.handle(provider, responseMessage)
    expect(requestor.socket.lastSendMessage).toBe(null)
  })

  it('doesn\'t throw error on response after timeout', (done) => {
    const requestor = new SocketWrapper(new SocketMock(), {})
    const provider = new SocketWrapper(new SocketMock(), {})

      // Register provider
    subscriptionMessage.action = C.ACTIONS.SUBSCRIBE
    rpcHandler.handle(provider, subscriptionMessage)
    expect(provider.socket.lastSendMessage).toBe(_msg('P|A|S|addTwo+'))

      // Issue Rpc
    rpcHandler.handle(requestor, requestMessage)

      // Ack
    rpcHandler.handle(provider, ackMessage)

      // Response timeout
    setTimeout(() => {
      rpcHandler.handle(provider, responseMessage)
      expect(provider.socket.lastSendMessage).toBe(_msg('P|E|INVALID_RPC_CORRELATION_ID|unexpected state for rpc addTwo with action RES+'))
      done()
    }, 30)
  })

  it('executes remote rpcs', () => {
    // This is terrible practice, but we don't have any means to access the object otherwise
    rpcHandler._subscriptionRegistry.getAllRemoteServers = () => ['random-server-1']

    options.message.reset()

    const requestor = new SocketWrapper(new SocketMock(), {})
    expect(options.message.lastPublishedMessage).toBeNull()

    // There are no local providers for the substract rpc
    rpcHandler.handle(requestor, remoteRequestMessage)

    expect(options.message.lastDirectSentMessage).toEqual({
      serverName: 'random-server-1',
      topic: 'PRIVATE/P',
      message: remoteRequestMessage
    })
    expect(requestor.socket.lastSendMessage).toBeNull()

    options.message.simulateIncomingMessage('PRIVATE/P', privateRemoteAckMessage)
    expect(requestor.socket.lastSendMessage).toBe(_msg('P|A|REQ|substract|4+'))

    // forwards response from remote provider to requestor
    options.message.simulateIncomingMessage('PRIVATE/P', privateRemoteResponseMessage)
    expect(requestor.socket.lastSendMessage).toBe(_msg('P|RES|substract|4|5+'))

    // ignores subsequent responses
    requestor.socket.lastSendMessage = null
    options.message.simulateIncomingMessage('PRIVATE/P', privateRemoteResponseMessage)
    expect(requestor.socket.lastSendMessage).toBeNull()

    options.message.simulateIncomingMessage('PRIVATE/P', privateRemoteAckMessageUnknown)
    expect(requestor.socket.lastSendMessage).toBeNull()
    expect(options.logger.lastLogEvent).toBe('INVALID_RPC_CORRELATION_ID')
  })

  describe('encounters errors while making an RPC', () => {
    const requestor = new SocketWrapper(new SocketMock(), {})

    it('attempts an rpc with invalid message data', () => {
      rpcHandler.handle(requestor, {
        topic: C.TOPIC.RPC,
        action: C.ACTIONS.REQUEST,
        raw: 'invalid-raw-message',
        data: ['addTwo']
      })

      expect(requestor.socket.lastSendMessage).toBe(_msg('P|E|INVALID_MESSAGE_DATA|invalid-raw-message+'))
    })
  })
})
