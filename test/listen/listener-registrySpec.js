/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let ListenerRegistry = require('../../src/listen/listener-registry'),
  msg = require('../test-helper/test-helper').msg,
  SocketMock = require('../mocks/socket-mock'),
  SocketWrapper = require('../../src/message/socket-wrapper'),
  LoggerMock = require('../mocks/logger-mock'),
  clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))(),
  noopMessageConnector = require('../../src/default-plugins/noop-message-connector')

let listenerRegistry,
  options = {
    clusterRegistry: clusterRegistryMock,
    messageConnector: noopMessageConnector,
    logger: {
      log: jasmine.createSpy('logger')
    }
  },
  recordSubscriptionRegistryMock = {
    getNames() {
      return ['car/Mercedes', 'car/Abarth']
    }
  }

describe('listener-registry errors', () => {
  beforeEach(() => {
    listenerRegistry = new ListenerRegistry('R', options, recordSubscriptionRegistryMock)
    expect(typeof listenerRegistry.handle).toBe('function')
  })

  it('adds a listener without message data', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), options)
    listenerRegistry.handle(socketWrapper, {
      topic: 'R',
      action: 'L',
      data: []
    })
    expect(options.logger.log).toHaveBeenCalledWith(3, 'INVALID_MESSAGE_DATA', undefined)
    expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|undefined+'))
  })

  it('adds a listener with invalid message data message data', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), options)
    listenerRegistry.handle(socketWrapper, {
      topic: 'R',
      action: 'L',
      data: [44]
    })
    expect(options.logger.log).toHaveBeenCalledWith(3, 'INVALID_MESSAGE_DATA', 44)
    expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|44+'))
  })

  it('adds a listener with an invalid regexp', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), options)
    listenerRegistry.handle(socketWrapper, {
      topic: 'R',
      action: 'L',
      data: ['us(']
    })
    expect(options.logger.log).toHaveBeenCalledWith(3, 'INVALID_MESSAGE_DATA', 'SyntaxError: Invalid regular expression: /us(/: Unterminated group')
    expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|SyntaxError: Invalid regular expression: /us(/: Unterminated group+'))
  })
})
