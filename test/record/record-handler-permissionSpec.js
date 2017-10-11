'use strict'

const RecordHandler = require('../../src/record/record-handler').default

const M = require('./messages')
const C = require('../../src/constants')
const testHelper = require('../test-helper/test-helper')
const getTestMocks = require('../test-helper/test-mocks')

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

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect(services.permissionHandler.lastArgs.length).toBe(2)
    expect(services.permissionHandler.lastArgs[0][1].action).toBe(C.RECORD_ACTIONS.CREATE)
    expect(services.permissionHandler.lastArgs[1][1].action).toBe(C.RECORD_ACTIONS.READ)
  })

  it('triggers only read action if record does exist', () => {
    services.cache.set('some-record', {}, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.readResponseMessage)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect(services.permissionHandler.lastArgs.length).toBe(1)
    expect(services.permissionHandler.lastArgs[0][1].action).toBe(C.RECORD_ACTIONS.READ)
  })

  it('rejects a create', () => {
    services.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.createDeniedMessage, C.EVENT.MESSAGE_DENIED)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect(services.permissionHandler.lastArgs.length).toBe(1)
    expect(services.permissionHandler.lastArgs[0][1].action).toBe(C.RECORD_ACTIONS.CREATE)
  })

  it('rejects a read', () => {
    services.cache.set('some-record', {}, () => {})
    services.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.readDeniedMessage, C.EVENT.MESSAGE_DENIED)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect(services.permissionHandler.lastArgs.length).toBe(1)
    expect(services.permissionHandler.lastArgs[0][1].action).toBe(C.RECORD_ACTIONS.READ)
  })

  it('handles a permission error', () => {
    services.permissionHandler.nextError = 'XXX'
    services.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.createDeniedMessage, C.EVENT.MESSAGE_PERMISSION_ERROR)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect(services.permissionHandler.lastArgs.length).toBe(1)
    expect(services.permissionHandler.lastArgs[0][1].action).toBe(C.RECORD_ACTIONS.CREATE)
  })
})
