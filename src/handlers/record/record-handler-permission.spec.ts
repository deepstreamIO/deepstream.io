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
    ({config, services} = testHelper.getDeepstreamOptions())
    recordHandler = new RecordHandler(config, services)

    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()
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
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTION.CREATE)
    expect(services.permission.lastArgs[1][1].action).to.equal(C.RECORD_ACTION.READ)
  })

  it('triggers only read action if record does exist', () => {
    services.cache.set('some-record', 0, {}, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.readResponseMessage)

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(1)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTION.READ)
  })

  it('rejects a create', () => {
    services.permission.nextResult = false

    const { names, ...msg } = M.subscribeCreateAndReadDeniedMessage
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({ ...msg, name: 'some-record', isError: true })

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(1)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTION.CREATE)
  })

  it('rejects a read', () => {
    services.cache.set('some-record', 0, {}, () => {})
    services.permission.nextResult = false

    const { names, ...msg } = M.subscribeCreateAndReadDeniedMessage
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({ ...msg, name: 'some-record', isError: true })

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(1)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTION.READ)
  })

  it('handles a permission error', () => {
    services.permission.nextError = 'XXX'
    services.permission.nextResult = false

    const { names, ...msg } = M.subscribeCreateAndReadPermissionErrorMessage
    client.socketWrapperMock
    .expects('sendMessage')
    .once()
    .withExactArgs({ ...msg, name: 'some-record', isError: true })

    recordHandler.handle(client.socketWrapper, M.subscribeCreateAndReadMessage)

    expect(services.permission.lastArgs.length).to.equal(1)
    expect(services.permission.lastArgs[0][1].action).to.equal(C.RECORD_ACTION.CREATE)
  })
})
