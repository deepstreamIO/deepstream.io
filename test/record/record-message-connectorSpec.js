/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let RecordHandler = require('../../src/record/record-handler'),
  msg = require('../test-helper/test-helper').msg,
  StorageMock = require('../mocks/storage-mock'),
  SocketMock = require('../mocks/socket-mock'),
  SocketWrapper = require('../../src/message/socket-wrapper'),
  LoggerMock = require('../mocks/logger-mock'),
  MessageConnectorMock = require('../mocks/message-connector-mock.js'),
  clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))()

describe('messages from direct connected clients and messages that come in via message connector co-exist peacefully', () => {
  let recordHandler,
    subscriber = new SocketWrapper(new SocketMock(), {}),
    options = {
      clusterRegistry: clusterRegistryMock,
      serverName: 'a-server-name',
      cache: new StorageMock(),
      storage: new StorageMock(),
      logger: new LoggerMock(),
      messageConnector: new MessageConnectorMock(),
      permissionHandler: { canPerformAction(a, b, c) { c(null, true) } },
      uniqueRegistry: {
        get(name, callback) { callback(true) },
        release() {}
      }
    }

  it('creates the record handler', () => {
    recordHandler = new RecordHandler(options)
    expect(recordHandler.handle).toBeDefined()
  })

  it('subscribes to a record', () => {
	    recordHandler.handle(subscriber, {
	    	topic: 'RECORD',
	    	action: 'CR',
	    	data: ['someRecord']
	    })

	    expect(options.messageConnector.lastPublishedMessage).toEqual({
	    	topic: 'R_SUB',
	    	action: 'DISTRIBUTED_STATE_ADD',
	    	data: ['someRecord', 'a-server-name', -5602883995]
	    })
	    expect(subscriber.socket.lastSendMessage).toBe(msg('R|R|someRecord|0|{}+'))
  })

  it('receives an update for a record via the messageConnector', () => {
    expect(options.cache.lastSetValue).toEqual({ _v: 0, _d: { } })
    expect(options.storage.lastSetValue).toEqual({ _v: 0, _d: { } })

	    recordHandler.handle('SOURCE_MESSAGE_CONNECTOR', {
	    	raw: msg('R|U|someRecord|1|{"firstname":"Wolfram"}+'),
	    	topic: 'RECORD',
	    	action: 'U',
	    	data: ['someRecord', 1, { firstname: 'Wolfram' }]
	    })

	    expect(subscriber.socket.lastSendMessage).toBe(msg('R|U|someRecord|1|{"firstname":"Wolfram"}+'))
	    expect(options.cache.lastSetValue).toEqual({ _v: 0, _d: { } })
    expect(options.storage.lastSetValue).toEqual({ _v: 0, _d: { } })
  })

  it('receives an update from the client and forwards it to the message connector', () => {
	    recordHandler.handle(subscriber, {
	    	raw: msg('R|U|someRecord|1|{"firstname":"Wolfram"}+'),
	    	topic: 'RECORD',
	    	action: 'U',
	    	data: ['someRecord', 1, '{"firstname":"Wolfram"}']
	    })

	    expect(options.cache.lastSetValue).toEqual({ _v: 1, _d: { firstname: 'Wolfram' } })
    expect(options.storage.lastSetValue).toEqual({ _v: 1, _d: { firstname: 'Wolfram' } })
    expect(options.messageConnector.lastPublishedMessage).toEqual({
	    	raw: msg('R|U|someRecord|1|{"firstname":"Wolfram"}+'),
	    	topic: 'RECORD',
	    	action: 'U',
	    	data: ['someRecord', 1, '{"firstname":"Wolfram"}']
	    })
  })
})
