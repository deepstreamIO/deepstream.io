import 'mocha'
import { expect } from 'chai'

import * as C from '../../constants'
import RpcHandler from './rpc-handler'

import * as testHelper from '../../test/helper/test-helper'
import { getTestMocks } from '../../test/helper/test-mocks'
import { RpcProxy } from './rpc-proxy'

const options = testHelper.getDeepstreamOptions()
const config = options.config
const services = options.services

describe('the rpcHandler routes events correctly', () => {
  let testMocks
  let rpcHandler

  let requestor
  let provider

  beforeEach(() => {
    testMocks = getTestMocks()
    rpcHandler = new RpcHandler(config, services, testMocks.subscriptionRegistry)
    requestor = testMocks.getSocketWrapper('requestor', {}, { color: 'blue' })
    provider = testMocks.getSocketWrapper('provider')
  })

  afterEach(() => {
    testMocks.subscriptionRegistryMock.verify()
    requestor.socketWrapperMock.verify()
    provider.socketWrapperMock.verify()
  })

  it('routes subscription messages', () => {
    const subscriptionMessage = {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.PROVIDE,
      names: ['someRPC'],
      correlationId: '123'
    }
    testMocks.subscriptionRegistryMock
      .expects('subscribeBulk')
      .once()
      .withExactArgs(subscriptionMessage, provider.socketWrapper)

    rpcHandler.handle(provider.socketWrapper, subscriptionMessage)
  })

  describe('when receiving a request', () => {
    const requestMessage = {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.REQUEST,
      name: 'addTwo',
      correlationId: 1234,
      data: '{"numA":5, "numB":7}'
    }

    const acceptMessage = {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.ACCEPT,
      name: 'addTwo',
      correlationId: 1234
    }

    const responseMessage = {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.RESPONSE,
      name: 'addTwo',
      correlationId: 1234,
      data: '12'
    }

    const errorMessage = {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.REQUEST_ERROR,
      isError: true,
      name: 'addTwo',
      correlationId: 1234,
      data: 'ErrorOccured'
    }

    beforeEach(() => {
      testMocks.subscriptionRegistryMock
        .expects('getLocalSubscribers')
        .once()
        .withExactArgs('addTwo')
        .returns([provider.socketWrapper])
    })

    it('forwards it to a provider', () => {
      provider.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(Object.assign({
          requestorData: { color: 'blue' },
          requestorName: 'requestor'
        }, requestMessage))

      rpcHandler.handle(requestor.socketWrapper, requestMessage)
    })

    it('accepts first accept', () => {
      requestor.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(acceptMessage)

      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, acceptMessage)
    })

    it('errors when recieving more than one ack', () => {
      provider.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTION.MULTIPLE_ACCEPT,
          name: requestMessage.name,
          correlationId: requestMessage.correlationId
        })

      provider.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(Object.assign({
          requestorData: { color: 'blue' },
          requestorName: 'requestor'
        }, requestMessage))

      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, acceptMessage)
      rpcHandler.handle(provider.socketWrapper, acceptMessage)
    })

    it('gets a response', () => {
      requestor.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(responseMessage)

      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, responseMessage)
    })

    it('replies with an error to additonal responses', () => {
      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, responseMessage)

      provider.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTION.INVALID_RPC_CORRELATION_ID,
          originalAction: responseMessage.action,
          name: responseMessage.name,
          correlationId: responseMessage.correlationId,
          isError: true
        })

      rpcHandler.handle(provider.socketWrapper, responseMessage)
    })

    it('gets an error', () => {
      requestor.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs(errorMessage)

      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, errorMessage)
    })

    it('replies with an error after the first message', () => {
      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, errorMessage)

      provider.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTION.INVALID_RPC_CORRELATION_ID,
          originalAction: errorMessage.action,
          name: errorMessage.name,
          correlationId: errorMessage.correlationId,
          isError: true
        })

      rpcHandler.handle(provider.socketWrapper, errorMessage)
    })

    it('supports multiple RPCs in quick succession', () => {
      testMocks.subscriptionRegistryMock
        .expects('getLocalSubscribers')
        .exactly(49)
        .withExactArgs('addTwo')
        .returns([provider.socketWrapper])

      expect(() => {
        for (let i = 0; i < 50; i++) {
          rpcHandler.handle(requestor.socketWrapper, requestMessage)
        }
      }).not.to.throw()
    })

    it('times out if no ack is received', (done) => {
      rpcHandler.handle(requestor.socketWrapper, requestMessage)

      requestor.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTION.ACCEPT_TIMEOUT,
          name: requestMessage.name,
          correlationId: requestMessage.correlationId
        })

      setTimeout(done, config.rpc.ackTimeout * 2)
    })

    it('times out if response is not received in time', (done) => {
      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, acceptMessage)

      requestor.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTION.RESPONSE_TIMEOUT,
          name: requestMessage.name,
          correlationId: requestMessage.correlationId
        })

      setTimeout(done, config.rpc.responseTimeout * 2)
    })

    // Should an Ack for a non existant rpc should error?
    it.skip('ignores ack message if it arrives after response', (done) => {
      provider.socketWrapperMock
        .expects('sendMessage')
        .twice()

      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, responseMessage)

      setTimeout(() => {
        rpcHandler.handle(provider.socketWrapper, acceptMessage)
        done()
      }, 30)
    })

    it('doesn\'t throw error on response after timeout', (done) => {
      rpcHandler.handle(requestor.socketWrapper, requestMessage)
      rpcHandler.handle(provider.socketWrapper, acceptMessage)

      requestor.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.RPC,
          action: C.RPC_ACTION.RESPONSE_TIMEOUT,
          name: requestMessage.name,
          correlationId: requestMessage.correlationId
        })

      setTimeout(() => {
        provider.socketWrapperMock
          .expects('sendMessage')
          .once()
          .withExactArgs({
            topic: C.TOPIC.RPC,
            action: C.RPC_ACTION.INVALID_RPC_CORRELATION_ID,
            originalAction: responseMessage.action,
            name: responseMessage.name,
            correlationId: responseMessage.correlationId,
            isError: true
          })
        rpcHandler.handle(provider.socketWrapper, responseMessage)
        done()
      }, 30)
    })
  })

  describe.skip('rpc handler returns alternative providers for the same rpc', () => {
    let providerForA1
    let providerForA2
    let providerForA3
    let usedProviders

    before(() => {
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
        action: C.RPC_ACTION.REQUEST,
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

    after(() => {
      testMocks.subscriptionRegistryMock.verify()
    })

    it('gets alternative rpc providers', () => {
      let alternativeProvider
      // first proxy
      alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
      expect(alternativeProvider).not.to.equal(null)
      expect(alternativeProvider instanceof RpcProxy).to.equal(false)
      expect(usedProviders.indexOf(alternativeProvider)).to.equal(-1)
      // second provider
      alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
      expect(alternativeProvider).not.to.equal(null)
      expect(alternativeProvider instanceof RpcProxy).to.equal(false)
      expect(usedProviders.indexOf(alternativeProvider)).to.equal(-1)
      // remote provider
      alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
      expect(alternativeProvider).not.to.equal(null)
      expect(alternativeProvider instanceof RpcProxy).to.equal(true)
      expect(usedProviders.indexOf(alternativeProvider)).to.equal(-1)
      // remote alternative provider
      alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
      expect(alternativeProvider).not.to.equal(null)
      expect(alternativeProvider instanceof RpcProxy).to.equal(true)
      expect(usedProviders.indexOf(alternativeProvider)).to.equal(-1)
      // null
      alternativeProvider = rpcHandler.getAlternativeProvider('rpcA', '1234')
      expect(alternativeProvider).to.equal(null)
    })
  })

  describe('the rpcHandler uses requestor fields correctly', () => {
    beforeEach(() => {
      testMocks = getTestMocks()
      requestor = testMocks.getSocketWrapper('requestor', {}, { bestLanguage: 'not BF' })
      provider = testMocks.getSocketWrapper('provider')
      testMocks.subscriptionRegistryMock
          .expects('getLocalSubscribers')
          .once()
          .withExactArgs('addTwo')
          .returns([provider.socketWrapper])
    })

    afterEach(() => {
      testMocks.subscriptionRegistryMock.verify()
      requestor.socketWrapperMock.verify()
      provider.socketWrapperMock.verify()
    })

    const requestMessage = {
      topic: C.TOPIC.RPC,
      action: C.RPC_ACTION.REQUEST,
      name: 'addTwo',
      correlationId: 1234,
      data: '{"numA":5, "numB":7}'
    }

    for (const nameAvailable of [true, false]) {
      for (const dataAvailable of [true, false]) {
        const name = `name=${nameAvailable} data=${dataAvailable}`
        it(name, () => {
          config.rpc.provideRequestorName = nameAvailable
          config.rpc.provideRequestorData = dataAvailable

          const expectedMessage = Object.assign({}, requestMessage)
          if (nameAvailable) {
            Object.assign(expectedMessage, { requestorName: 'requestor' })
          }
          if (dataAvailable) {
            Object.assign(expectedMessage, { requestorData: { bestLanguage: 'not BF' } })
          }
          provider.socketWrapperMock
              .expects('sendMessage')
              .once()
              .withExactArgs(expectedMessage)

          rpcHandler = new RpcHandler(config, services, testMocks.subscriptionRegistry)
          rpcHandler.handle(requestor.socketWrapper, requestMessage)
        })
    }
  }

    // it ('overwrites fake requestorName and fake requestorData', () => {
    //   config.provideRPCRequestorDetails = true
    //   config.RPCRequestorNameTerm = null
    //   config.RPCRequestorDataTerm = null
    //
    //   provider.socketWrapperMock
    //     .expects('sendMessage')
    //     .once()
    //     .withExactArgs(Object.assign({
    //       requestorName: 'requestor',
    //       requestorData: { bestLanguage: 'not BF' }
    //     }, requestMessage))
    //
    //   const fakeRequestMessage = Object.assign({
    //     requestorName: 'evil-requestor',
    //     requestorData: { bestLanguage: 'malbolge' }
    //   }, requestMessage)
    //   rpcHandler = new RpcHandler(config, services, testMocks.subscriptionRegistry)
    //   rpcHandler.handle(requestor.socketWrapper, fakeRequestMessage)
    // })

  })

})
