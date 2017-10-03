/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
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
  let options

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()
    options = testHelper.getDeepstreamOptions()
    recordHandler = new RecordHandler(options.config, options.services)
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

 
  it('triggers create and read actions if record doesnt exist', () => {
    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.readMessage)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect( options.services.permissionHandler.lastArgs.length).toBe(2)
    expect( options.services.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.CREATE)
    expect( options.services.permissionHandler.lastArgs[1][1].action).toBe(C.ACTIONS.READ)
  })

  it('triggers only read action if record does exist', () => {
    options.services.cache.set('some-record', {}, () => {})

    client.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs(M.readMessage)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect( options.services.permissionHandler.lastArgs.length).toBe(1)
    expect( options.services.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.READ)
  })

  it('rejects a create', () => {
     options.services.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.createDeniedMessage, C.EVENT.MESSAGE_DENIED)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect( options.services.permissionHandler.lastArgs.length).toBe(1)
    expect( options.services.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.CREATE)
  })

  it('rejects a read', () => {
    options.services.cache.set('some-record', {}, () => {})
     options.services.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.readDeniedMessage, C.EVENT.MESSAGE_DENIED)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect( options.services.permissionHandler.lastArgs.length).toBe(1)
    expect( options.services.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.READ)
  })

  it('handles a permission error', () => {
     options.services.permissionHandler.nextError = 'XXX'
     options.services.permissionHandler.nextResult = false

    client.socketWrapperMock
      .expects('sendError')
      .once()
      .withExactArgs(M.createDeniedMessage, C.EVENT.MESSAGE_PERMISSION_ERROR)

    recordHandler.handle(client.socketWrapper, M.createOrReadMessage)

    expect( options.services.permissionHandler.lastArgs.length).toBe(1)
    expect( options.services.permissionHandler.lastArgs[0][1].action).toBe(C.ACTIONS.CREATE)
  })
})
