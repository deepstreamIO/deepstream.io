import * as C from '../../src/constants'

const RpcHandler = require('../../src/rpc/rpc-handler').default
const testHelper = require('../test-helper/test-helper')
import { getTestMocks } from '../test-helper/test-mocks'

const options = testHelper.getDeepstreamOptions()
const config = options.config
config.provideRPCRequestorDetails = false // Set to false as default
const services = options.services

describe('the rpcHandler uses requestor fields correctly', () => {
  let testMocks
  let rpcHandler
  let requestor
  let provider

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
    action: C.RPC_ACTIONS.REQUEST,
    name: 'addTwo',
    correlationId: 1234,
    data: '{"numA":5, "numB":7}'
  }

  for (const allAvailable of [true, false]) {
    for (const nameAvailable of [true, false]) {
      for (const dataAvailable of [true, false]) {
        const name = `all=${allAvailable} name=${nameAvailable} data=${dataAvailable}`
        it(name, () => {
          config.provideRPCRequestorDetails = allAvailable
          config.provideRPCRequestorName = nameAvailable
          config.provideRPCRequestorData = dataAvailable
          const nameExpectedVisibility = allAvailable || nameAvailable
          const dataExpectedVisibility = allAvailable || dataAvailable

          const expectedMessage = Object.assign({}, requestMessage)
          if (nameExpectedVisibility) {
            Object.assign(expectedMessage, { requestorName: 'requestor' })
          }
          if (dataExpectedVisibility) {
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
  }

  it ('overwrites fake requestorName and fake requestorData', () => {
    config.provideRPCRequestorDetails = true
    config.RPCRequestorNameTerm = null
    config.RPCRequestorDataTerm = null

    provider.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(Object.assign({
        requestorName: 'requestor',
        requestorData: { bestLanguage: 'not BF' }
      }, requestMessage))

    const fakeRequestMessage = Object.assign({
      requestorName: 'evil-requestor',
      requestorData: { bestLanguage: 'malbolge' }
    }, requestMessage)
    rpcHandler = new RpcHandler(config, services, testMocks.subscriptionRegistry)
    rpcHandler.handle(requestor.socketWrapper, fakeRequestMessage)
  })

})
