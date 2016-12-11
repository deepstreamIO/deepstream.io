/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

/* global describe, expect, it, jasmine */
let EventHandler = require('../../src/event/event-handler'),
  msg = require('../test-helper/test-helper').msg,
  SocketMock = require('../mocks/socket-mock'),
  SocketWrapper = require('../../src/message/socket-wrapper'),
  LoggerMock = require('../mocks/logger-mock'),
  noopMessageConnector = require('../../src/default-plugins/noop-message-connector'),
  clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))(),
  options = {
    clusterRegistry: clusterRegistryMock,
    serverName: 'server-name-a',
    stateReconciliationTimeout: 10,
    messageConnector: noopMessageConnector,
    logger: new LoggerMock(),
    uniqueRegistry: {
      get(name, callback) { callback(true) },
      release() {}
    }
  },
  eventHandler,
  subscribingClient = new SocketWrapper(new SocketMock(), {}),
  listeningClient = new SocketWrapper(new SocketMock(), {})

describe('event handler handles messages', () => {
  it('creates the event handler', () => {
    eventHandler = new EventHandler(options)
    expect(eventHandler.handle).toBeDefined()
  })

  it('subscribes to event a and b', () => {
    eventHandler.handle(subscribingClient, {
      topic: 'E',
      action: 'S',
      data: ['event/A']
    })
    expect(subscribingClient.socket.lastSendMessage).toBe(msg('E|A|S|event/A+'))
    eventHandler.handle(subscribingClient, {
      topic: 'E',
      action: 'S',
      data: ['event/B']
    })
    expect(subscribingClient.socket.lastSendMessage).toBe(msg('E|A|S|event/B+'))
  })

  it('registers a listener', () => {
    eventHandler.handle(listeningClient, {
				 topic: 'E',
				 action: 'L',
				 data: ['event\/.*']
    })

    expect(listeningClient.socket.getMsg(2)).toBe(msg('E|A|L|event\/.*+'))
    expect(listeningClient.socket.getMsg(1)).toBe(msg('E|SP|event\/.*|event/A+'))
    expect(listeningClient.socket.getMsg(0)).toBe(msg('E|SP|event\/.*|event/B+'))
  })

  it('makes a new subscription', () => {
			 eventHandler.handle(subscribingClient, {
   topic: 'E',
   action: 'S',
   data: ['event/C']
 })
    expect(subscribingClient.socket.lastSendMessage).toBe(msg('E|A|S|event/C+'))
    expect(listeningClient.socket.lastSendMessage).toBe(msg('E|SP|event\/.*|event/C+'))
  })

  it('doesn\'t send messages for subsequent subscriptions', () => {
			 expect(listeningClient.socket.sendMessages.length).toBe(4)
			 eventHandler.handle(subscribingClient, {
   topic: 'E',
   action: 'S',
   data: ['event/C']
 })
    expect(listeningClient.socket.sendMessages.length).toBe(4)
  })

  it('removes listeners', () => {
			 eventHandler.handle(listeningClient, {
				 topic: 'E',
				 action: 'UL',
				 data: ['event\/.*']
 })

    expect(listeningClient.socket.lastSendMessage).toBe(msg('E|A|UL|event\/.*+'))
    expect(listeningClient.socket.sendMessages.length).toBe(5)

			 eventHandler.handle(subscribingClient, {
   topic: 'E',
   action: 'CR',
   data: ['event/D']
 })
    expect(listeningClient.socket.sendMessages.length).toBe(5)
  })
})
