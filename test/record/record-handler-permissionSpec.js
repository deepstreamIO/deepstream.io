/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const RecordHandler = require('../../src/record/record-handler')

const C = require('../../src/constants/constants')
const testHelper = require('../test-helper/test-helper')
const getTestMocks = require('../test-helper/test-mocks')

describe('record handler handles messages', () => {
  let testMocks
  let recordHandler
  let client
  let options

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()
    options = testHelper.getDeepstreamOptions()
    recordHandler = new RecordHandler(options)
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  const createOrReadMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.CREATEORREAD,
    name: 'some-record'
  }

  const readMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.READ,
    name: 'some-record',
    version: 0,
    parsedData: {}
  }

  const readDeniedMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.READ,
    name: 'some-record'
  }

  const createDeniedMessage = {
    topic: C.TOPIC.RECORD,
    action: C.ACTIONS.CREATE,
    name: 'some-record'
  }

  it('triggers create and read actions if record doesnt exist', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(readMessage)

    recordHandler.handle(client.socketWrapper, createOrReadMessage)

    expect(options.permissionHandler.lastArgs.length).toBe(2)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.CREATE)
    expect(options.permissionHandler.lastArgs[1][1].action).toBe(C.ACTIONS.READ)
  })

  it('triggers only read action if record does exist', () => {
    options.cache.set('some-record', {}, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(readMessage)

    recordHandler.handle(client.socketWrapper, createOrReadMessage)

    expect(options.permissionHandler.lastArgs.length).toBe(1)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.READ)
  })

  it('rejects a create', () => {
    options.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(createDeniedMessage, C.EVENT.MESSAGE_DENIED)

    recordHandler.handle(client.socketWrapper, createOrReadMessage)

    expect(options.permissionHandler.lastArgs.length).toBe(1)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.CREATE)
  })

  it('rejects a read', () => {
    options.cache.set('some-record', {}, () => {})
    options.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(readDeniedMessage, C.EVENT.MESSAGE_DENIED)

    recordHandler.handle(client.socketWrapper, createOrReadMessage)

    expect(options.permissionHandler.lastArgs.length).toBe(1)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.READ)
  })

  it('handles a permission error', () => {
    options.permissionHandler.nextError = 'XXX'
    options.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(createDeniedMessage, C.EVENT.MESSAGE_PERMISSION_ERROR)

    recordHandler.handle(client.socketWrapper, createOrReadMessage)

    expect(options.permissionHandler.lastArgs.length).toBe(1)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.CREATE)
  })
})
