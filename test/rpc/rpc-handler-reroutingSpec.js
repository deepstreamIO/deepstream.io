/* import/no-extraneous-dependencies */
/* global jasmine, beforeAll, afterAll, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const RpcHandler = require('../../src/rpc/rpc-handler').default
const RpcProxy = require('../../src/rpc/rpc-proxy').default

const C = require('../../src/constants')
const testHelper = require('../test-helper/test-helper')
const getTestMocks = require('../test-helper/test-mocks')

const options = testHelper.getDeepstreamOptions()
const config = options.config
const services = options.services

config.rpcAckTimeout = 50
config.rpcTimeout = 50

describe('rpc handler returns alternative providers for the same rpc', () => {
  let testMocks
  let rpcHandler
  let providerForA1
  let providerForA2
  let providerForA3
  let usedProviders

  beforeAll(() => {
    testMocks = getTestMocks()
    providerForA1 = testMocks.getSocketWrapper('a1')
    providerForA2 = testMocks.getSocketWrapper('a2')
    providerForA3 = testMocks.getSocketWrapper('a3')

    rpcHandler = new RpcHandler(config, services, testMocks.subscriptionRegistry)

    testMocks.subscriptionRegistryMock
      .expects('getLocalSubscribers')
      .once()
      .withExactArgs('rpcA')
      .returns([
        providerForA1.socketWrapper
      ])

    rpcHandler.handle(providerForA1.socketWrapper, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      name: 'rpcA',
      correlationId: '1234',
      data: 'U'
    })
    usedProviders = [providerForA1.socketWrapper]

    testMocks.subscriptionRegistryMock
      .expects('getLocalSubscribers')
      .exactly(5)
      .withExactArgs('rpcA')
      .returns([
        providerForA2.socketWrapper,
        providerForA3.socketWrapper
      ])

    testMocks.subscriptionRegistryMock
      .expects('getAllRemoteServers')
      .thrice()
      .withExactArgs('rpcA')
      .returns(['random-server-1', 'random-server-2'])
  })

  afterAll(() => {
    testMocks.subscriptionRegistryMock.verify()
  })

  it('gets alternative rpc providers', () => {
    let alternativeProvider
    // first proxy
    alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).not.toBeNull()
    expect(alternativeProvider instanceof RpcProxy).toBe(false)
    expect(usedProviders.indexOf(alternativeProvider)).toBe(-1)
    // second provider
    alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).not.toBeNull()
    expect(alternativeProvider instanceof RpcProxy).toBe(false)
    expect(usedProviders.indexOf(alternativeProvider)).toBe(-1)
    // remote provider
    alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).not.toBeNull()
    expect(alternativeProvider instanceof RpcProxy).toBe(true)
    expect(usedProviders.indexOf(alternativeProvider)).toBe(-1)
    // remote alternative provider
    alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).not.toBeNull()
    expect(alternativeProvider instanceof RpcProxy).toBe(true)
    expect(usedProviders.indexOf(alternativeProvider)).toBe(-1)
    // null
    alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
    expect(alternativeProvider).toBeNull()
  })
})
