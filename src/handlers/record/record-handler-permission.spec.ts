import 'mocha'
import { expect } from 'chai'

import * as C from '../../../src/constants'

import RecordHandler from './record-handler'

import * as M from './test-messages'
import * as testHelper from '../../test/helper/test-helper'
import { getTestMocks } from '../../test/helper/test-mocks'

describe('record handler handles messages', () => {
  let testMocks
  let recordHandler
  let client
  let config
  let services

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()
    const options = testHelper.getDeepstreamOptions()
    config = options.config
    services = options.services
    recordHandler = new RecordHandler(config, services)
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  it('triggers create and read actions if record doesnt exist', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.readResponseMessage)

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(2)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTIONS.CREATE)
    expect(services.permission.lastArgs[1][1].action).to.equal(C.RECORD_ACTIONS.READ)
  })

  it('triggers only read action if record does exist', () => {
    services.cache.set('some-record', 0, {}, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.readResponseMessage)

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(1)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTIONS.READ)
  })

  it('rejects a create', () => {
    services.permission.nextResult = false

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.subscribeCreateAndReadDeniedMessage)

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(1)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTIONS.CREATE)
  })

  it('rejects a read', () => {
    services.cache.set('some-record', 0, {}, () => {})
    services.permission.nextResult = false

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.subscribeCreateAndReadDeniedMessage)

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(1)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTIONS.READ)
  })

  it('handles a permission error', () => {
    services.permission.nextError = 'XXX'
    services.permission.nextResult = false

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.subscribeCreateAndReadPermissionErrorMessage)

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(1)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTIONS.CREATE)
  })
})
