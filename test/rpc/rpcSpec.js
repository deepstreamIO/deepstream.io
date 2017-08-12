/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const C = require('../../src/constants/constants')
const Rpc = require('../../src/rpc/rpc')
const msg = require('../test-helper/test-helper').msg
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const SocketMock = require('../mocks/socket-mock')
const RpcProxy = require('../../src/rpc/rpc-proxy')
const MockMessageConnector = require('../mocks/message-connector-mock')

const alternativeProvider = new SocketWrapper(new SocketMock(), {})
const mockRpcHandler = {
  getAlternativeProvider () {
    return alternativeProvider
  },
  _$onDestroy () {}
}
const mockMessageConnector = new MockMessageConnector()
const options = {
  rpcAckTimeout: 15,
  rpcTimeout: 15
}
const requestMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.REQUEST,
  raw: msg('P|REQ|addTwo|1234|O{"numA":5, "numB":7}+'),
  data: ['addTwo', '1234', 'O{"numA":5, "numB":7}']
}
const ackMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.ACK,
  raw: msg('P|A|REQ|addTwo|1234+'),
  data: ['REQ', 'addTwo', '1234']
}
const errorMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.ERROR,
  raw: msg('P|E|ErrorOccured|addTwo|1234+'),
  data: ['ErrorOccured', 'addTwo', '1234']
}
const responseMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.RESPONSE,
  raw: msg('P|RES|addTwo|1234|N12+'),
  data: ['addTwo', '1234', 'N12']
}
const makeRpc = function (message) {
  const provider = new SocketWrapper(new SocketMock(), {})
  const requestor = new SocketWrapper(new SocketMock(), {})
  const localRpc = new Rpc(mockRpcHandler, requestor, provider, options, message)

  return {
    provider,
    requestor,
    localRpc
  }
}

describe('rpc', () => {

  describe('executes local rpc calls', () => {
    it('sends the original rpc request to the provider', () => {
      const provider = makeRpc(requestMessage).provider
      expect(provider.socket.lastSendMessage).toBe(msg('P|REQ|addTwo|1234|O{"numA":5, "numB":7}+'))
    })

    it('times out if no ack is received in time', (done) => {
      const requestor = makeRpc(requestMessage).requestor

      setTimeout(() => {
        expect(requestor.socket.lastSendMessage).toBe(msg('P|E|ACK_TIMEOUT|addTwo|1234+'))
        done()
      }, options.rpcAckTimeout + 2)
    })

    it('forwards ack message', () => {
      const rpc = makeRpc(requestMessage)
      rpc.localRpc.handle(ackMessage)
      expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|A|REQ|addTwo|1234+'))
    })

    it('times out if response is not received in time', (done) => {
      const rpc = makeRpc(requestMessage)
      rpc.localRpc.handle(ackMessage)
      expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|A|REQ|addTwo|1234+'))
      setTimeout(() => {
        expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|E|RESPONSE_TIMEOUT|addTwo|1234+'))
        done()
      }, options.rpcTimeout + 2)
    })

    it('forwards response message', () => {
      const rpc = makeRpc(requestMessage)
      rpc.localRpc.handle(ackMessage)
      expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|A|REQ|addTwo|1234+'))
      rpc.localRpc.handle(responseMessage)
      expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|RES|addTwo|1234|N12+'))
    })

    it('forwards error message', () => {
      const rpc = makeRpc(requestMessage)
      rpc.localRpc.handle(errorMessage)
      expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|E|ErrorOccured|addTwo|1234+'))
    })

    it('sends error for multiple ack messages', () => {
      const rpc = makeRpc(requestMessage)

      rpc.localRpc.handle(ackMessage)
      expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|A|REQ|addTwo|1234+'))
      expect(rpc.provider.socket.lastSendMessage).toBe(msg('P|REQ|addTwo|1234|O{"numA":5, "numB":7}+'))

      rpc.localRpc.handle(ackMessage)
      expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|A|REQ|addTwo|1234+'))
      expect(rpc.provider.socket.lastSendMessage).toBe(msg('P|E|MULTIPLE_ACK|addTwo|1234+'))
    })
  })

  describe('reroutes remote rpc calls', () => {
    let rpc
    let provider
    let requestor

    it('creates a remote to local rpc', () => {
      const rpcProxyOptions = {
        messageConnector: mockMessageConnector,
        serverName: 'serverNameA'
      }

      provider = new SocketWrapper(new SocketMock(), {})
      requestor = new RpcProxy(rpcProxyOptions, 'private/xyz', 'addTwo', '1234')
      requestor.send = jasmine.createSpy('send')
      requestor.sendError = jasmine.createSpy('sendError')
      rpc = new Rpc(mockRpcHandler, requestor, provider, options, requestMessage)
      expect(requestor.send).not.toHaveBeenCalled()
    })

    it('receives a unrelated message from the provider', () => {
      rpc.handle({
        topic: C.TOPIC.RPC,
        action: C.ACTIONS.REQUEST,
        raw: msg('P|REQ|addTwo|1234|O{"numA":5, "numB":7}+'),
        data: ['not', 'related', 'O{"numA":5, "numB":7}']
      })
      expect(requestor.send).not.toHaveBeenCalled()
    })

    it('receives a rejection message from the original provider', () => {
      spyOn(mockRpcHandler, 'getAlternativeProvider').and.callThrough()
      expect(alternativeProvider.socket.lastSendMessage).toBe(null)

      rpc.handle({
        topic: C.TOPIC.RPC,
        action: C.ACTIONS.REJECTION,
        raw: msg('P|REJ|addTwo|1234|O{"numA":5, "numB":7}+'),
        data: ['addTwo', '1234']
      })

      expect(alternativeProvider.socket.lastSendMessage).toBe(msg('P|REQ|addTwo|1234|O{"numA":5, "numB":7}+'))
      expect(mockRpcHandler.getAlternativeProvider).toHaveBeenCalled()
      expect(requestor.send).not.toHaveBeenCalled()
      expect(requestor.sendError).not.toHaveBeenCalled()
    })

    it('rejects the message again and runs out of alternative providers', () => {
      mockRpcHandler.getAlternativeProvider = function () { return null }

      rpc.handle({
        topic: C.TOPIC.RPC,
        action: C.ACTIONS.REJECTION,
        raw: msg('P|REJ|addTwo|1234|O{"numA":5, "numB":7}+'),
        data: ['addTwo', '1234']
      })

      expect(requestor.send).not.toHaveBeenCalled()
      expect(requestor.sendError).toHaveBeenCalledWith('P', 'NO_RPC_PROVIDER', ['addTwo', '1234'])
    })
  })
})
