/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

/* global describe, expect, it, jasmine */
const EventHandler = require('../../src/event/event-handler')
const msg = require('../test-helper/test-helper').msg
const SocketMock = require('../mocks/socket-mock')
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const testHelper = require('../test-helper/test-helper')

const subscribingClient = new SocketWrapper(new SocketMock(), {})
const listeningClient = new SocketWrapper(new SocketMock(), {})

let eventHandler

describe('event handler handles messages', () => {
  it('creates the event handler', () => {
    eventHandler = new EventHandler(testHelper.getDeepstreamOptions())
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
      data: ['event/.*']
    })

    expect(listeningClient.socket.getMsg(2)).toBe(msg('E|A|L|event/.*+'))
    expect(listeningClient.socket.getMsg(1)).toBe(msg('E|SP|event/.*|event/A+'))
    expect(listeningClient.socket.getMsg(0)).toBe(msg('E|SP|event/.*|event/B+'))
  })

  it('makes a new subscription', () => {
    eventHandler.handle(subscribingClient, {
      topic: 'E',
      action: 'S',
      data: ['event/C']
    })
    expect(subscribingClient.socket.lastSendMessage).toBe(msg('E|A|S|event/C+'))
    expect(listeningClient.socket.lastSendMessage).toBe(msg('E|SP|event/.*|event/C+'))
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
      data: ['event/.*']
    })

    expect(listeningClient.socket.lastSendMessage).toBe(msg('E|A|UL|event/.*+'))
    expect(listeningClient.socket.sendMessages.length).toBe(5)

    eventHandler.handle(subscribingClient, {
      topic: 'E',
      action: 'CR',
      data: ['event/D']
    })
    expect(listeningClient.socket.sendMessages.length).toBe(5)
  })
})
