/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let RecordHandler = require('../../src/record/record-handler'),
  msg = require('../test-helper/test-helper').msg,
  StorageMock = require('../mocks/storage-mock'),
  SocketMock = require('../mocks/socket-mock'),
  SocketWrapper = require('../../src/message/socket-wrapper'),
  LoggerMock = require('../mocks/logger-mock'),
  noopMessageConnector = require('../../src/default-plugins/noop-message-connector'),
  clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))()

const permissionHandler = {
  nextResult: true,
  nextError: null,
  lastArgs: [],
  canPerformAction(a, b, c) {
    this.lastArgs.push(arguments)
    c(this.nextError, this.nextResult)
  }
}

describe('record handler handles messages', () => {
  let recordHandler,
    clientA = new SocketWrapper(new SocketMock(), {}),
    clientB = new SocketWrapper(new SocketMock(), {}),
    options = {
      clusterRegistry: clusterRegistryMock,
      cache: new StorageMock(),
      storage: new StorageMock(),
      storageExclusion: new RegExp('no-storage'),
      logger: new LoggerMock(),
      messageConnector: noopMessageConnector,
      permissionHandler,
      uniqueRegistry: {
        get(name, callback) { callback(true) },
        release() {}
      }
    }

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

    expect(permissionHandler.lastArgs.length).toBe(2)
    expect(permissionHandler.lastArgs[0][1].action).toBe('C')
    expect(permissionHandler.lastArgs[1][1].action).toBe('R')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|some-record|0|{}+'))
  })

  it('triggers only read action if record does exist', () => {
    permissionHandler.lastArgs = []

    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'CR',
      data: ['some-record']
    })

    expect(permissionHandler.lastArgs.length).toBe(1)
    expect(permissionHandler.lastArgs[0][1].action).toBe('R')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|R|some-record|0|{}+'))
  })

  it('rejects a read', () => {
    permissionHandler.lastArgs = []
    permissionHandler.nextResult = false

    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'CR',
      data: ['some-record']
    })

    expect(permissionHandler.lastArgs.length).toBe(1)
    expect(permissionHandler.lastArgs[0][1].action).toBe('R')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|MESSAGE_DENIED|some-record|R+'))
  })

  it('handles a permission error', () => {
    permissionHandler.lastArgs = []
    permissionHandler.nextError = 'XXX'
    permissionHandler.nextResult = false

    recordHandler.handle(clientA, {
      raw: 'raw-message',
      topic: 'R',
      action: 'CR',
      data: ['some-record']
    })

    expect(permissionHandler.lastArgs.length).toBe(1)
    expect(permissionHandler.lastArgs[0][1].action).toBe('R')
    expect(clientA.socket.lastSendMessage).toBe(msg('R|E|MESSAGE_PERMISSION_ERROR|XXX+'))
  })
})
