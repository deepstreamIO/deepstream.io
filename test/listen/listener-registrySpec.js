/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ListenerRegistry = require('../../src/listen/listener-registry')
const testHelper = require('../test-helper/test-helper')
const SocketMock = require('../mocks/socket-mock')
const SocketWrapper = require('../mocks/socket-wrapper-mock')

const options = testHelper.getDeepstreamOptions()
const msg = testHelper.msg
let listenerRegistry

const recordSubscriptionRegistryMock = {
  getNames () {
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
    expect(options.logger.lastLogArguments).toEqual([3, 'INVALID_MESSAGE_DATA', undefined])
    expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|undefined+'))
  })

  it('adds a listener with invalid message data message data', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), options)
    listenerRegistry.handle(socketWrapper, {
      topic: 'R',
      action: 'L',
      data: [44]
    })
    expect(options.logger.lastLogArguments).toEqual([3, 'INVALID_MESSAGE_DATA', 44])
    expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|44+'))
  })

  it('adds a listener with an invalid regexp', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), options)
    listenerRegistry.handle(socketWrapper, {
      topic: 'R',
      action: 'L',
      data: ['us(']
    })
    expect(options.logger.lastLogArguments).toEqual([3, 'INVALID_MESSAGE_DATA', 'SyntaxError: Invalid regular expression: /us(/: Unterminated group'])
    expect(socketWrapper.socket.lastSendMessage).toBe(msg('R|E|INVALID_MESSAGE_DATA|SyntaxError: Invalid regular expression: /us(/: Unterminated group+'))
  })
})
