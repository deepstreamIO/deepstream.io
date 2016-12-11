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

describe('record handler handles messages', () => {
  let recordHandler,
    subscribingClient = new SocketWrapper(new SocketMock(), {}),
    listeningClient = new SocketWrapper(new SocketMock(), {}),
    options = {
      clusterRegistry: clusterRegistryMock,
      cache: new StorageMock(),
      storage: new StorageMock(),
      logger: new LoggerMock(),
      messageConnector: noopMessageConnector,
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

  it('subscribes to record a and b', () => {
    recordHandler.handle(subscribingClient, {
      topic: 'R',
      action: 'CR',
      data: ['user/A']
    })
    expect(subscribingClient.socket.lastSendMessage).toBe(msg('R|R|user/A|0|{}+'))
    recordHandler.handle(subscribingClient, {
      topic: 'R',
      action: 'CR',
      data: ['user/B']
    })
    expect(subscribingClient.socket.lastSendMessage).toBe(msg('R|R|user/B|0|{}+'))
  })

  it('registers a listener', () => {
    recordHandler.handle(listeningClient, {
				 topic: 'R',
				 action: 'L',
				 data: ['user\/.*']
    })

    expect(listeningClient.socket.getMsg(2)).toBe(msg('R|A|L|user\/.*+'))
    expect(listeningClient.socket.getMsg(1)).toBe(msg('R|SP|user\/.*|user/A+'))
    expect(listeningClient.socket.getMsg(0)).toBe(msg('R|SP|user\/.*|user/B+'))
  })

  it('makes a new subscription', () => {
			 recordHandler.handle(subscribingClient, {
   topic: 'R',
   action: 'CR',
   data: ['user/C']
 })
    expect(subscribingClient.socket.lastSendMessage).toBe(msg('R|R|user/C|0|{}+'))
    expect(listeningClient.socket.lastSendMessage).toBe(msg('R|SP|user\/.*|user/C+'))
  })

  it('doesn\'t send messages for subsequent subscriptions', () => {
			 expect(listeningClient.socket.sendMessages.length).toBe(4)
			 recordHandler.handle(subscribingClient, {
   topic: 'R',
   action: 'CR',
   data: ['user/C']
 })
    expect(listeningClient.socket.sendMessages.length).toBe(4)
  })

  it('removes listeners', () => {
			 recordHandler.handle(listeningClient, {
				 topic: 'R',
				 action: 'UL',
				 data: ['user\/.*']
 })

    expect(listeningClient.socket.lastSendMessage).toBe(msg('R|A|UL|user\/.*+'))
    expect(listeningClient.socket.sendMessages.length).toBe(5)

			 recordHandler.handle(subscribingClient, {
   topic: 'R',
   action: 'CR',
   data: ['user/D']
 })
    expect(listeningClient.socket.sendMessages.length).toBe(5)
  })
})
