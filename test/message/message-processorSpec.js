/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let SocketMock = require('../mocks/socket-mock'),
  SocketWrapper = require('../../src/message/socket-wrapper'),
  permissionHandlerMock = require('../mocks/permission-handler-mock'),
  MessageProcessor = require('../../src/message/message-processor'),
  _msg = require('../test-helper/test-helper').msg,
  messageProcessor,
  log,
  lastAuthenticatedMessage = null

describe('the message processor only forwards valid, authorized messages', () => {
  it('creates the message processor', () => {
    log = jasmine.createSpy('log')
    messageProcessor = new MessageProcessor({
      permissionHandler: permissionHandlerMock,
      logger: { log }
    })
    messageProcessor.onAuthenticatedMessage = function (socketWrapper, message) {
      lastAuthenticatedMessage = message
    }
  })

  it('rejects invalid messages', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    messageProcessor.process(socketWrapper, 'gibberish')
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('X|E|MESSAGE_PARSE_ERROR|gibberish+'))
  })

  it('rejects non text based messages messages', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    messageProcessor.process(socketWrapper, [{}])
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('X|E|MESSAGE_PARSE_ERROR|non text based message recieved+'))
  })

  it('ignores heartbeats pongs messages', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    messageProcessor.process(socketWrapper, _msg('C|PO+'))
    expect(socketWrapper.socket.lastSendMessage).toBeNull()
  })

  it('handles permission errors', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    permissionHandlerMock.nextCanPerformActionResult = 'someError'
    messageProcessor.process(socketWrapper, _msg('R|R|/user/wolfram+'))
    expect(log).toHaveBeenCalled()
    expect(log).toHaveBeenCalledWith(2, 'MESSAGE_PERMISSION_ERROR', 'someError')
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('R|E|MESSAGE_PERMISSION_ERROR|/user/wolfram|R+'))
  })

  it('handles denied messages', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    permissionHandlerMock.nextCanPerformActionResult = false
    messageProcessor.process(socketWrapper, _msg('R|R|/user/wolfram+'))
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('R|E|MESSAGE_DENIED|/user/wolfram|R+'))
  })

  it('provides the correct arguments to canPerformAction', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    socketWrapper.user = 'someUser'
    permissionHandlerMock.nextCanPerformActionResult = false
    messageProcessor.process(socketWrapper, _msg('R|R|/user/wolfram+'))
    expect(permissionHandlerMock.lastCanPerformActionQueryArgs.length).toBe(4)
    expect(permissionHandlerMock.lastCanPerformActionQueryArgs[0]).toBe('someUser')
    expect(permissionHandlerMock.lastCanPerformActionQueryArgs[1].data[0]).toBe('/user/wolfram')
  })

  it('forwards validated and permissioned messages', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    socketWrapper.user = 'someUser'
    permissionHandlerMock.nextCanPerformActionResult = true
    expect(lastAuthenticatedMessage).toBe(null)
    messageProcessor.process(socketWrapper, _msg('R|R|/user/wolfram+'))
    expect(lastAuthenticatedMessage.raw).toBe(_msg('R|R|/user/wolfram'))
  })
})
