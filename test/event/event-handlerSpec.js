/* import/no-extraneous-dependencies */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const SocketWrapper = require('../mocks/socket-wrapper-mock')
const EventHandler = require('../../src/event/event-handler')

const C = require('../../src/constants/constants')
const testHelper = require('../test-helper/test-helper')
const SocketMock = require('../mocks/socket-mock')

const _msg = testHelper.msg

const subscriptionsMessage = {
  topic: C.TOPIC.EVENT,
  action: C.ACTIONS.SUBSCRIBE,
    // raw: 'rawMessageString',
  data: ['someEvent']
}
const eventMessage = {
  topic: C.TOPIC.EVENT,
  action: C.ACTIONS.EVENT,
    // raw: 'rawMessageString',
  data: ['someEvent']
}

const options = testHelper.getDeepstreamOptions()
const eventHandler = new EventHandler(options)

describe('the eventHandler routes events correctly', () => {
  it('sends an error for invalid subscription messages', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    const invalidMessage = {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.SUBSCRIBE,
      raw: 'rawMessageString'
    }

    eventHandler.handle(socketWrapper, invalidMessage)
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('E|E|INVALID_MESSAGE_DATA|rawMessageString+'))
  })

  it('sends an error for subscription messages without an event name', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    const invalidMessage = {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.SUBSCRIBE,
      raw: 'rawMessageString',
      data: []
    }

    eventHandler.handle(socketWrapper, invalidMessage)
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('E|E|INVALID_MESSAGE_DATA|rawMessageString+'))
  })

  it('sends an error for subscription messages with an invalid action', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    const invalidMessage = {
      topic: C.TOPIC.EVENT,
      action: 'giberrish',
      raw: 'rawMessageString',
      data: []
    }

    eventHandler.handle(socketWrapper, invalidMessage)
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('E|E|UNKNOWN_ACTION|unknown action giberrish+'))
  })

  it('subscribes to events', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    expect(socketWrapper.socket.lastSendMessage).toBe(null)
    eventHandler.handle(socketWrapper, subscriptionsMessage)
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('E|A|S|someEvent+'))
  })

  it('triggers events', () => {
    const socketA = new SocketWrapper(new SocketMock(), {})
    const socketB = new SocketWrapper(new SocketMock(), {})

    eventHandler.handle(socketA, subscriptionsMessage)
    eventHandler.handle(socketB, subscriptionsMessage)

    expect(socketA.socket.lastSendMessage).toBe(_msg('E|A|S|someEvent+'))
    expect(socketB.socket.lastSendMessage).toBe(_msg('E|A|S|someEvent+'))

         // Raise event from socketA - only socketB should be notified
    eventHandler.handle(socketA, eventMessage)
    expect(socketA.socket.lastSendMessage).toBe(_msg('E|A|S|someEvent+'))
    expect(socketB.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent+'))

         // Raise event from socketB - socket A should be notified
    eventHandler.handle(socketB, eventMessage)
    expect(socketA.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent+'))
    expect(socketB.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent+'))

         // Add event data
    eventMessage.data[1] = 'eventData'
    eventHandler.handle(socketB, eventMessage)
    expect(socketA.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent|eventData+'))
    expect(socketB.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent+'))

         // Add another socket
    const socketC = new SocketWrapper(new SocketMock(), {})
    eventHandler.handle(socketC, subscriptionsMessage)
    expect(socketC.socket.lastSendMessage).toBe(_msg('E|A|S|someEvent+'))

         // Raise an event for all sockets
    eventHandler.handle(socketA, eventMessage)
    expect(socketA.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent|eventData+'))
    expect(socketB.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent|eventData+'))
    expect(socketC.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent|eventData+'))
  })

  it('sends errors for invalid messages', () => {
    const socketA = new SocketWrapper(new SocketMock(), {})

    eventHandler.handle(socketA, {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      raw: 'rawMessageString',
      data: []
    })

    expect(socketA.socket.lastSendMessage).toBe(_msg('E|E|INVALID_MESSAGE_DATA|rawMessageString+'))
  })

  it('unsubscribes', () => {
    const socketA = new SocketWrapper(new SocketMock(), {})
    const socketB = new SocketWrapper(new SocketMock(), {})
    const socketC = new SocketWrapper(new SocketMock(), {})

    eventHandler.handle(socketA, subscriptionsMessage)
    eventHandler.handle(socketB, subscriptionsMessage)
    eventHandler.handle(socketC, subscriptionsMessage)

    eventHandler.handle(socketA, eventMessage)
    expect(socketA.socket.lastSendMessage).toBe(_msg('E|A|S|someEvent+'))
    expect(socketB.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent|eventData+'))
    expect(socketC.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent|eventData+'))

    subscriptionsMessage.action = C.ACTIONS.UNSUBSCRIBE
    eventHandler.handle(socketB, subscriptionsMessage)

    expect(socketA.socket.lastSendMessage).toBe(_msg('E|A|S|someEvent+'))
    expect(socketB.socket.lastSendMessage).toBe(_msg('E|A|US|someEvent+'))
    expect(socketC.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent|eventData+'))

    eventMessage.data[1] = 'otherData'
    eventHandler.handle(socketA, eventMessage)

    expect(socketA.socket.lastSendMessage).toBe(_msg('E|A|S|someEvent+'))
    expect(socketB.socket.lastSendMessage).toBe(_msg('E|A|US|someEvent+'))
    expect(socketC.socket.lastSendMessage).toBe(_msg('E|EVT|someEvent|otherData+'))
  })
})

