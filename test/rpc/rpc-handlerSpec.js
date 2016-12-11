/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let RpcHandler = require('../../src/rpc/rpc-handler'),
  SocketWrapper = require('../../src/message/socket-wrapper'),
  C = require('../../src/constants/constants'),
  _msg = require('../test-helper/test-helper').msg,
  SocketMock = require('../mocks/socket-mock'),
  MessageConnectorMock = require('../mocks/message-connector-mock'),
  LoggerMock = require('../mocks/logger-mock'),
  clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))(),
  options = {
    clusterRegistry: clusterRegistryMock,
    messageConnector: new MessageConnectorMock(),
    logger: new LoggerMock(),
    serverName: 'thisServer',
    rpcAckTimeout: 5,
    rpcTimeout: 5
  },
  rpcHandler = new RpcHandler(options),
  subscriptionMessage = {
    topic: C.TOPIC.RPC,
    action: C.ACTIONS.SUBSCRIBE,
    raw: 'rawMessageString',
    data: ['addTwo']
  },
  requestMessage = {
    topic: C.TOPIC.RPC,
    action: C.ACTIONS.REQUEST,
    raw: _msg('P|REQ|addTwo|1234|{"numA":5, "numB":7}+'),
    data: ['addTwo', '1234', '{"numA":5, "numB":7}']
  },
  ackMessage = {
    topic: C.TOPIC.RPC,
    action: C.ACTIONS.ACK,
    raw: _msg('P|A|REQ|addTwo|1234+'),
    data: ['REQ', 'addTwo', '1234']
  },
  errorMessage = {
    topic: C.TOPIC.RPC,
    action: C.ACTIONS.ERROR,
    raw: _msg('P|E|ErrorOccured|addTwo|1234+'),
    data: ['ErrorOccured', 'addTwo', '1234']
  },
  responseMessage = {
    topic: C.TOPIC.RPC,
    action: C.ACTIONS.RESPONSE,
    raw: _msg('P|RES|addTwo|1234|12+'),
    data: ['addTwo', '1234', '12']
  },
  additionalResponseMessage = {
    topic: C.TOPIC.RPC,
    action: C.ACTIONS.RESPONSE,
    raw: _msg('P|RES|addTwo|1234|14+'),
    data: ['addTwo', '1234', '14']
  },
  remoteRequestMessage = {
    topic: C.TOPIC.RPC,
    action: C.ACTIONS.REQUEST,
    raw: _msg('P|REQ|substract|44|{"numA":8, "numB":3}+'),
    data: ['substract', '4', '{"numA":8, "numB":3}']
  },
  privateRemoteRequestMessage = {
    topic: 'PRIVATE/remoteTopic',
    action: C.ACTIONS.REQUEST,
    originalTopic: C.TOPIC.RPC,
    remotePrivateTopic: C.TOPIC.PRIVATE + options.serverName,
    raw: _msg('P|REQ|substract|44|{"numA":8, "numB":3}+'),
    data: ['substract', '4', '{"numA":8, "numB":3}']
  },
  privateRemoteAckMessage = {
    topic: C.TOPIC.PRIVATE + options.serverName,
    action: C.ACTIONS.ACK,
    raw: _msg('P|A|REQ|substract|4+'),
    originalTopic: C.TOPIC.RPC,
    data: ['REQ', 'substract', '4']
  },
  privateRemoteResponseMessage = {
    topic: C.TOPIC.PRIVATE + options.serverName,
    action: C.ACTIONS.RESPONSE,
    raw: _msg('P|RES|substract|4|5+'),
    originalTopic: C.TOPIC.RPC,
    data: ['substract', '4', '5']
  }

describe('the rpc handler', () => {
  describe('routes remote procedure call related messages', () => {
    it('sends an error for subscription messages without data', () => {
      let socketWrapper = new SocketWrapper(new SocketMock(), {}),
        invalidMessage = {
          topic: C.TOPIC.RPC,
          action: C.ACTIONS.SUBSCRIBE,
          raw: 'rawMessageString1'
        }

      rpcHandler.handle(socketWrapper, invalidMessage)
      expect(socketWrapper.socket.lastSendMessage).toBe(_msg('P|E|INVALID_MESSAGE_DATA|rawMessageString1+'))
    })

    it('sends an error for invalid subscription messages ', () => {
      let socketWrapper = new SocketWrapper(new SocketMock(), {}),
        invalidMessage = {
          topic: C.TOPIC.RPC,
          action: C.ACTIONS.SUBSCRIBE,
          raw: 'rawMessageString2',
          data: [1, 'a']
        }

      rpcHandler.handle(socketWrapper, invalidMessage)
      expect(socketWrapper.socket.lastSendMessage).toBe(_msg('P|E|INVALID_MESSAGE_DATA|rawMessageString2+'))
    })

    it('sends an error for unknown actions', () => {
      let socketWrapper = new SocketWrapper(new SocketMock(), {}),
        invalidMessage = {
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
      let requestor = new SocketWrapper(new SocketMock(), {}),
        provider = new SocketWrapper(new SocketMock(), {})

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
      expect(provider.socket.lastSendMessage).toBe(_msg('P|E|INVALID_MESSAGE_DATA|unexpected state for rpc addTwo with action RES+'))
    })

    it('executes local rpcs - error scenario', () => {
      let requestor = new SocketWrapper(new SocketMock(), {}),
        provider = new SocketWrapper(new SocketMock(), {})

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
      expect(provider.socket.lastSendMessage).toBe(_msg('P|E|INVALID_MESSAGE_DATA|unexpected state for rpc addTwo with action E+'))
    })

    it('supports multiple RPCs in quick succession', () => {
      let requestor = new SocketWrapper(new SocketMock(), {}),
        provider = new SocketWrapper(new SocketMock(), {})

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

  it('executes remote rpcs', () => {
    let requestor

		// This is terrible practice, but we don't have any means to access the object otherwise
    rpcHandler._subscriptionRegistry.getAllRemoteServers = function (name) {
      return ['random-server-1']
    }

    options.messageConnector.reset()

    requestor = new SocketWrapper(new SocketMock(), {})
    expect(options.messageConnector.lastPublishedMessage).toBeNull()

		// There are no local providers for the substract rpc
    rpcHandler.handle(requestor, remoteRequestMessage)
    delete options.messageConnector.lastPublishedMessage.raw
    expect(options.messageConnector.lastPublishedMessage).toEqual({
      topic: 'PRIVATE/random-server-1',
      action: 'REQ',
      data: ['substract', '4', '{"numA":8, "numB":3}'],
      remotePrivateTopic: 'PRIVATE/thisServer',
      originalTopic: 'P' }
		)
    expect(requestor.socket.lastSendMessage).toBeNull()

    options.messageConnector.simulateIncomingMessage(privateRemoteAckMessage)
    expect(requestor.socket.lastSendMessage).toBe(_msg('P|A|REQ|substract|4+'))

		// forwards response from remote provider to requestor
    options.messageConnector.simulateIncomingMessage(privateRemoteResponseMessage)
    expect(requestor.socket.lastSendMessage).toBe(_msg('P|RES|substract|4|5+'))

		// ignores subsequent responses
    requestor.socket.lastSendMessage = null
    options.messageConnector.simulateIncomingMessage(privateRemoteResponseMessage)
    expect(requestor.socket.lastSendMessage).toBeNull()
  })
})
