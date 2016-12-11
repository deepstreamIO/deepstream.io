/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let C = require('../../src/constants/constants'),
  Rpc = require('../../src/rpc/rpc'),
  msg = require('../test-helper/test-helper').msg,
  SocketWrapper = require('../../src/message/socket-wrapper'),
  SocketMock = require('../mocks/socket-mock'),
  RpcProxy = require('../../src/rpc/rpc-proxy'),
  alternativeProvider = new SocketWrapper(new SocketMock(), {}),
  mockRpcHandler = { getAlternativeProvider() { return alternativeProvider } },
	mockMessageConnector = new (require('../mocks/message-connector-mock'))(),
	options = {
  rpcAckTimeout: 5,
  rpcTimeout: 5
},
	requestMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.REQUEST,
  raw: msg('P|REQ|addTwo|1234|O{"numA":5, "numB":7}+'),
  data: ['addTwo', '1234', 'O{"numA":5, "numB":7}']
},
	ackMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.ACK,
  raw: msg('P|A|REQ|addTwo|1234+'),
  data: ['REQ', 'addTwo', '1234']
},
	errorMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.ERROR,
  raw: msg('P|E|ErrorOccured|addTwo|1234+'),
  data: ['ErrorOccured', 'addTwo', '1234']
},
	responseMessage = {
  topic: C.TOPIC.RPC,
  action: C.ACTIONS.RESPONSE,
  raw: msg('P|RES|addTwo|1234|N12+'),
  data: ['addTwo', '1234', 'N12']
},
	makeRpc = function (msg) {
  let provider = new SocketWrapper(new SocketMock(), {}),
    requestor = new SocketWrapper(new SocketMock(), {}),
    localRpc = new Rpc(mockRpcHandler, requestor, provider, options, msg)

  return {
    provider,
    requestor,
    localRpc
  }
}

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
    }, 7)
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
    }, 8)
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

  it('ignores ack message if it arrives after response', () => {
    const rpc = makeRpc(requestMessage)
    rpc.localRpc.handle(responseMessage)
    expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|RES|addTwo|1234|N12+'))
    rpc.localRpc.handle(ackMessage)
    expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|RES|addTwo|1234|N12+'))
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

  it('ignores multiple responses', () => {
    const rpc = makeRpc(requestMessage)

    rpc.localRpc.handle(ackMessage)
    expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|A|REQ|addTwo|1234+'))

    rpc.localRpc.handle(responseMessage)
    expect(rpc.requestor.socket.lastSendMessage).toBe(msg('P|RES|addTwo|1234|N12+'))

    rpc.requestor.socket.lastSendMessage = null

    rpc.localRpc.handle(responseMessage)
    expect(rpc.requestor.socket.lastSendMessage).toBe(null)
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
