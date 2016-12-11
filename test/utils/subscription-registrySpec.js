/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let SubscriptionRegistry = require('../../src/utils/subscription-registry'),
  SocketMock = require('../mocks/socket-mock'),
  SocketWrapper = require('../../src/message/socket-wrapper'),
  lastLogEvent = null,
  socketWrapperOptions = { logger: { log() {} } },
  _msg = require('../test-helper/test-helper').msg,
  LocalMessageConnector = require('../mocks/local-message-connector'),
  clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))(),
  options = {
    clusterRegistry: clusterRegistryMock,
    serverName: 'server-name-a',
    stateReconciliationTimeout: 10,
    messageConnector: new LocalMessageConnector(),
    logger: { log(level, event, message) { lastLogEvent = event } }
  },
  subscriptionRegistry = new SubscriptionRegistry(options, 'E'),
  subscriptionListenerMock = {
    onSubscriptionMade: jasmine.createSpy('onSubscriptionMade'),
    onSubscriptionRemoved: jasmine.createSpy('onSubscriptionRemoved')
  }

subscriptionRegistry.setSubscriptionListener(subscriptionListenerMock)

describe('subscription-registry manages subscriptions', () => {
  let socketWrapperA = new SocketWrapper(new SocketMock(), socketWrapperOptions),
    socketWrapperB = new SocketWrapper(new SocketMock(), socketWrapperOptions)

  it('subscribes to names', () => {
    expect(socketWrapperA.socket.lastSendMessage).toBe(null)

    subscriptionRegistry.subscribe('someName', socketWrapperA)
    expect(subscriptionListenerMock.onSubscriptionMade).toHaveBeenCalledWith('someName', socketWrapperA, 1)
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('E|A|S|someName+'))
    subscriptionRegistry.sendToSubscribers('someName', _msg('someMessage+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('someMessage+'))
  })

  it('doesn\'t subscribe twice to the same name', () => {
    expect(lastLogEvent).toBe('S')
    subscriptionRegistry.subscribe('someName', socketWrapperA)
    expect(subscriptionListenerMock.onSubscriptionMade.calls.count()).toBe(1)
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('E|E|MULTIPLE_SUBSCRIPTIONS|someName+'))
    expect(lastLogEvent).toBe('MULTIPLE_SUBSCRIPTIONS')
  })

  it('returns the subscribed socket', () => {
    expect(subscriptionRegistry.getLocalSubscribers('someName')).toEqual([socketWrapperA])
  })

  it('determines if it has subscriptions', () => {
    expect(subscriptionRegistry.hasLocalSubscribers('someName')).toBe(true)
    expect(subscriptionRegistry.hasLocalSubscribers('someOtherName')).toBe(false)
  })

  it('distributes messages to multiple subscribers', () => {
    subscriptionRegistry.subscribe('someName', socketWrapperB)
    subscriptionRegistry.sendToSubscribers('someName', _msg('msg2+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msg2+'))
    expect(socketWrapperB.socket.lastSendMessage).toBe(_msg('msg2+'))
  })

  it('returns a random subscribed socket', () => {
    if (socketWrapperA.uuid < socketWrapperB.uuid) {
      expect(subscriptionRegistry.getLocalSubscribers('someName')).toEqual([socketWrapperA, socketWrapperB])
    } else {
      expect(subscriptionRegistry.getLocalSubscribers('someName')).toEqual([socketWrapperB, socketWrapperA])
    }

    let returnedA = false,
      returnedB = false,
      randomSubscriber,
      i

    for (i = 0; i < 100; i++) {
      randomSubscriber = subscriptionRegistry.getRandomLocalSubscriber('someName')
      if (randomSubscriber === socketWrapperA) returnedA = true
      if (randomSubscriber === socketWrapperB) returnedB = true
    }

    expect(returnedA).toBe(true)
    expect(returnedB).toBe(true)
  })

  it('doesn\'t send message to sender', () => {
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msg2+'))
    expect(socketWrapperB.socket.lastSendMessage).toBe(_msg('msg2+'))
    subscriptionRegistry.sendToSubscribers('someName', _msg('msg3+'), socketWrapperA)
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msg2+'))
    expect(socketWrapperB.socket.lastSendMessage).toBe(_msg('msg3+'))
  })

  it('unsubscribes', () => {
    subscriptionRegistry.sendToSubscribers('someName', _msg('msg4+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msg4+'))
    expect(socketWrapperB.socket.lastSendMessage).toBe(_msg('msg4+'))

    subscriptionRegistry.unsubscribe('someName', socketWrapperB)
    expect(socketWrapperB.socket.lastSendMessage).toBe(_msg('E|A|US|someName+'))
    subscriptionRegistry.sendToSubscribers('someName', _msg('msg5+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msg5+'))
    expect(socketWrapperB.socket.lastSendMessage).toBe(_msg('E|A|US|someName+'))

    expect(subscriptionRegistry.isLocalSubscriber(socketWrapperA)).toBe(true)
    expect(subscriptionRegistry.isLocalSubscriber(socketWrapperB)).toBe(false)
  })

  it('handles unsubscribes for non existant topics', () => {
    subscriptionRegistry.unsubscribe('giberish', socketWrapperB)
    expect(socketWrapperB.socket.lastSendMessage).toBe(_msg('E|E|NOT_SUBSCRIBED|giberish+'))
  })

  it('handles unsubscribes for non existant subscriptions', () => {
    const newSocketWrapper = new SocketWrapper(new SocketMock(), socketWrapperOptions)
    subscriptionRegistry.unsubscribe('someName', newSocketWrapper)
    expect(newSocketWrapper.socket.lastSendMessage).toBe(_msg('E|E|NOT_SUBSCRIBED|someName+'))
  })

  it('routes the events', () => {
    subscriptionListenerMock.onSubscriptionRemoved.calls.reset()

    subscriptionRegistry.subscribe('someOtherName', socketWrapperA)
    subscriptionRegistry.sendToSubscribers('someOtherName', _msg('msg6+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msg6+'))

    subscriptionRegistry.sendToSubscribers('someName', _msg('msg7+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msg7+'))

    expect(subscriptionListenerMock.onSubscriptionRemoved).not.toHaveBeenCalled()
    subscriptionRegistry.unsubscribe('someName', socketWrapperA)
    expect(subscriptionListenerMock.onSubscriptionRemoved).toHaveBeenCalledWith('someName', socketWrapperA, 0, 0)
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('E|A|US|someName+'))
    subscriptionRegistry.sendToSubscribers('someName', _msg('msg8+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('E|A|US|someName+'))

    subscriptionRegistry.sendToSubscribers('someOtherName', _msg('msg9+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msg9+'))

    expect(subscriptionRegistry.isLocalSubscriber(socketWrapperA)).toBe(true)
    expect(subscriptionRegistry.isLocalSubscriber(socketWrapperB)).toBe(false)
  })

  it('removes all subscriptions on socket.close', () => {
    subscriptionRegistry.subscribe('nameA', socketWrapperA)
    subscriptionRegistry.subscribe('nameB', socketWrapperA)

    subscriptionRegistry.sendToSubscribers('nameA', _msg('msgA+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msgA+'))

    subscriptionRegistry.sendToSubscribers('nameB', _msg('msgB+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msgB+'))

    socketWrapperA.socket.emit('close')

    subscriptionRegistry.sendToSubscribers('nameA', _msg('msgC+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msgB+'))

    subscriptionRegistry.sendToSubscribers('nameB', _msg('msgD+'))
    expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('msgB+'))

    expect(subscriptionRegistry.isLocalSubscriber(socketWrapperA)).toBe(false)
  })
})

describe('subscription-registry allows custom actions to be set', () => {
  const subscriptionRegistry = new SubscriptionRegistry(options, 'E')
  const socketWrapper = new SocketWrapper(new SocketMock(), socketWrapperOptions)

  it('overrides the default actions', () => {
    subscriptionRegistry.setAction('subscribe', 'make-aware')
    subscriptionRegistry.setAction('unsubscribe', 'be-unaware')
    subscriptionRegistry.setAction('multiple_subscriptions', 'too-aware')
    subscriptionRegistry.setAction('not_subscribed', 'unaware')
  })

  it('subscribes to names', () => {
    subscriptionRegistry.subscribe('someName', socketWrapper)
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('E|A|make-aware|someName+'))
  })

  it('doesn\'t subscribe twice to the same name', () => {
    expect(lastLogEvent).toBe('make-aware')
    subscriptionRegistry.subscribe('someName', socketWrapper)
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('E|E|too-aware|someName+'))
    expect(lastLogEvent).toBe('too-aware')
  })

  it('unsubscribes', () => {
    subscriptionRegistry.unsubscribe('someName', socketWrapper)
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('E|A|be-unaware|someName+'))
  })

  it('handles unsubscribes for non existant subscriptions', () => {
    const newSocketWrapper = new SocketWrapper(new SocketMock(), socketWrapperOptions)
    subscriptionRegistry.unsubscribe('someName', newSocketWrapper)
    expect(newSocketWrapper.socket.lastSendMessage).toBe(_msg('E|E|unaware|someName+'))
  })
})

describe('subscription-registry unbinds all events on unsubscribe', () => {
  const subscriptionRegistry = new SubscriptionRegistry(options, 'E')
  const socketWrapper = new SocketWrapper(new SocketMock(), socketWrapperOptions)

  it('subscribes and unsubscribes 30 times', () => {
    for (let i = 0; i < 30; i++) {
      subscriptionRegistry.subscribe('repeated-test', socketWrapper)
      subscriptionRegistry.unsubscribe('repeated-test', socketWrapper)
    }
  })
})

describe('subscription-registry handles empty states', () => {
  const subscriptionRegistry = new SubscriptionRegistry(options, 'E')

  it('returns null if no subscriber is registered', () => {
    expect(subscriptionRegistry.getRandomLocalSubscriber()).toBe(null)
  })
})
