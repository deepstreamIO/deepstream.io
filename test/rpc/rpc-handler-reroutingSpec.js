/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, xit */
'use strict'

const RpcHandler = require('../../src/rpc/rpc-handler')
const RpcProxy = require('../../src/rpc/rpc-proxy')
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const C = require('../../src/constants/constants')
const SocketMock = require('../mocks/socket-mock')
const testHelper = require('../test-helper/test-helper')

const msg = testHelper.msg
const options = testHelper.getDeepstreamOptions()
options.rpcAckTimeout = 50
options.rpcTimeout = 50

describe('rpc handler returns alternative providers for the same rpc', () => {
  let rpcHandler
  let providerForA1
  let providerForA2
  let providerForA3
  let providerForB1

  beforeAll(() => {
    providerForA1 = new SocketWrapper(new SocketMock(), {})
    providerForA2 = new SocketWrapper(new SocketMock(), {})
    providerForA3 = new SocketWrapper(new SocketMock(), {})
    providerForB1 = new SocketWrapper(new SocketMock(), {})

    rpcHandler = new RpcHandler(options)
    expect(typeof rpcHandler.getAlternativeProvider).toBe('function')

    rpcHandler.handle(providerForA1, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.SUBSCRIBE,
      raw: 'rawMessageString',
      data: ['rpcA']
    })

    rpcHandler.handle(providerForA2, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.SUBSCRIBE,
      raw: 'rawMessageString',
      data: ['rpcA']
    })

    rpcHandler.handle(providerForA3, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.SUBSCRIBE,
      raw: 'rawMessageString',
      data: ['rpcA']
    })

    rpcHandler.handle(providerForB1, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.SUBSCRIBE,
      raw: 'rawMessageString',
      data: ['rpcB']
    })

    // This is terrible practice, but we don't have any means to access the object otherwise
    rpcHandler._subscriptionRegistry.getAllRemoteServers = function (name) {
      if (name === 'rpcA') {
        return ['random-server-1', 'random-server-2']
      }
      return []
    }
  })

  it('acks are sent to all providers', () => {
    expect(providerForA1.socket.lastSendMessage).toBe(msg('P|A|S|rpcA+'))
    expect(providerForA2.socket.lastSendMessage).toBe(msg('P|A|S|rpcA+'))
    expect(providerForA3.socket.lastSendMessage).toBe(msg('P|A|S|rpcA+'))
  })

  it('makes two a/b RPCs', () => {
    rpcHandler.handle(providerForA1, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      data: ['rpcA', '1234', 'U']
    })
    rpcHandler.handle(providerForB1, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      data: ['rpcB', '5678', 'U']
    })
  })

  it('returns a local alternative provider for a', () => {
    const alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).not.toBeNull()
    expect(alternativeProvider instanceof RpcProxy).toBe(false)
  })

  it('returns a local alternative provider for a that is not A1', () => {
    const alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).not.toBeNull()
    expect(alternativeProvider instanceof RpcProxy).toBe(false)
  })

  it('returns a remote alternative provider', () => {
    const alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).not.toBeNull()
    expect(alternativeProvider instanceof RpcProxy).toBe(true)
  })

  it('returns a remote alternative provider', () => {
    const alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).not.toBeNull()
    expect(alternativeProvider instanceof RpcProxy).toBe(true)
  })

  it('returns null when it runs out of providers', () => {
    const alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).toBeNull()
  })

  it('receives a remote request for a local rpc', () => {
    providerForB1.socket.lastSendMessage = null

    options.message.simulateIncomingMessage('PRIVATE/P', {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      data: ['rpcB', '1234', 'O{"numA":5, "numB":7}']
    })

    expect(providerForB1.socket.lastSendMessage).toEqual(msg('P|REQ|rpcB|1234|O{"numA":5, "numB":7}+'))
  })
})
