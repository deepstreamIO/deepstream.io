/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const RecordHandler = require('../../src/record/record-handler')
const SocketMock = require('../mocks/socket-mock')
const SocketWrapper = require('../mocks/socket-wrapper-mock')

const testHelper = require('../test-helper/test-helper')

const msg = testHelper.msg

describe('record handler handles messages', () => {
  let recordHandler
  const clientA = new SocketWrapper(new SocketMock(), {})
  const options = testHelper.getDeepstreamOptions()

  it('creates the record handler', () => {
    recordHandler = new RecordHandler(options)
    expect(recordHandler.handle).toBeDefined()
  })

  it('triggers create and read actions if record doesnt exist', () => {
    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'CR',
      data: ['some-record']
    })

    expect(options.permissionHandler.lastArgs.length).toBe(2)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe('C')
    expect(options.permissionHandler.lastArgs[1][1].action).toBe('R')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|some-record|0|{}+'))
  })

  it('triggers only read action if record does exist', () => {
    options.permissionHandler.lastArgs = []

    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'CR',
      data: ['some-record']
    })

    expect(options.permissionHandler.lastArgs.length).toBe(1)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe('R')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|some-record|0|{}+'))
  })

  it('rejects a read', () => {
    options.permissionHandler.lastArgs = []
    options.permissionHandler.nextResult = false

    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'CR',
      data: ['some-record']
    })

    expect(options.permissionHandler.lastArgs.length).toBe(1)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe('R')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|MESSAGE_DENIED|some-record|R+'))
  })

  it('handles a permission error', () => {
    options.permissionHandler.lastArgs = []
    options.permissionHandler.nextError = 'XXX'
    options.permissionHandler.nextResult = false

    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'CR',
      data: ['some-record']
    })

    expect(options.permissionHandler.lastArgs.length).toBe(1)
    expect(options.permissionHandler.lastArgs[0][1].action).toBe('R')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|MESSAGE_PERMISSION_ERROR|XXX+'))
  })
})
