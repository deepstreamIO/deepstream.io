/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const sinon = require('sinon')

const C = require('../../dist/src/constants/constants')
const testHelper = require('../test-helper/test-helper')
const getTestMocks = require('../test-helper/test-mocks')

const SubscriptionRegistry = require('../../dist/src/utils/subscription-registry')

const options = testHelper.getDeepstreamOptions()

const subscriptionListener = {
  onSubscriptionMade: () => {},
  onSubscriptionRemoved: () => {},
  onLastSubscriptionRemoved: () => {},
  onFirstSubscriptionMade: () => {},
}

let subscriptionRegistry
let subscriptionListenerMock

let clientA
let clientB

let testMocks

describe('subscription registry', () => {

  beforeEach(() => {
    testMocks = getTestMocks()

    subscriptionListenerMock = sinon.mock(subscriptionListener)
    subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.EVENT)
    subscriptionRegistry.setSubscriptionListener(subscriptionListener)

    clientA = testMocks.getSocketWrapper('client a')
    clientB = testMocks.getSocketWrapper('client b')
  })

  afterEach(() => {
    subscriptionListenerMock.verify()
    clientA.socketWrapperMock.verify()
    clientB.socketWrapperMock.verify()
  })

  const subscribeMessage = {
    topic: C.TOPIC.EVENT,
    action: C.ACTIONS.SUBSCRIBE,
    name: 'someName'
  }

  const unsubscribeMessage = {
    topic: C.TOPIC.EVENT,
    action: C.ACTIONS.UNSUBSCRIBE,
    name: 'someName'
  }

  const eventMessage = {
    topic: C.TOPIC.EVENT,
    action: C.ACTIONS.EVENT,
    name: 'someName'
  }

  describe('subscription-registry manages subscriptions', () => {
    it('subscribes to names', () => {
      clientA.socketWrapperMock
        .expects('sendAckMessage')
        .once()
        .withExactArgs(subscribeMessage)

      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)

      // expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('E|A|S|someName+'))

      // subscriptionRegistry.sendToSubscribers('someName', fakeEvent('someName', 'SsomeString'))
      // expect(socketWrapperA.socket.lastSendMessage).toBe(_msg('E|EVT|someName|SsomeString+'))
    })

    it('doesn\'t subscribe twice to the same name', () => {
      clientA.socketWrapperMock
        .expects('sendAckMessage')
        .once()
        .withExactArgs(subscribeMessage)

      clientA.socketWrapperMock
        .expects('sendError')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT
        }, C.EVENT.MULTIPLE_SUBSCRIPTIONS, 'someName')

      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)
      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)
      expect(options.logger.lastLogEvent).toBe('MULTIPLE_SUBSCRIPTIONS')
    })

    it('returns the subscribed socket', () => {
      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)
      expect(subscriptionRegistry.getLocalSubscribers('someName')).toEqual(new Set([clientA.socketWrapper]))
    })

    it('determines if it has subscriptions', () => {
      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)
      expect(subscriptionRegistry.hasLocalSubscribers('someName')).toBe(true)
      expect(subscriptionRegistry.hasLocalSubscribers('someOtherName')).toBe(false)
    })

    it('distributes messages to multiple subscribers', () => {
      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)
      subscriptionRegistry.subscribe(subscribeMessage, clientB.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendPrepared')
        .once()

      clientB.socketWrapperMock
        .expects('sendPrepared')
        .once()

      subscriptionRegistry.sendToSubscribers('someName', eventMessage)
    })

    it('doesn\'t send message to sender', () => {
      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)
      subscriptionRegistry.subscribe(subscribeMessage, clientB.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendPrepared')
        .never()

      clientB.socketWrapperMock
        .expects('sendPrepared')
        .once()

      subscriptionRegistry.sendToSubscribers('someName', eventMessage, false, clientA.socketWrapper)
    })

    it('unsubscribes', () => {
      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendAckMessage')
        .once()
        .withExactArgs(unsubscribeMessage)

      subscriptionRegistry.unsubscribe(unsubscribeMessage, clientA.socketWrapper)
    })

    it('handles unsubscribes for non existant topics', () => {
      clientA.socketWrapperMock
        .expects('sendError')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT
        }, C.EVENT.NOT_SUBSCRIBED, 'someName')

      subscriptionRegistry.unsubscribe(unsubscribeMessage, clientA.socketWrapper)
    })

    it('removes all subscriptions on socket.close', () => {
      subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)
      subscriptionRegistry.subscribe(Object.assign({}, subscribeMessage, { name: 'eventB' }), clientA.socketWrapper)

      clientA.socketWrapper.emit('close', clientA.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendPrepared')
        .never()

      subscriptionRegistry.sendToSubscribers('nameA', eventMessage)
      subscriptionRegistry.sendToSubscribers('nameB', eventMessage)
    })
  })

  describe('subscription-registry allows custom actions to be set', () => {
    beforeEach(() => {
      subscriptionRegistry.setAction('subscribe', 'make-aware')
      subscriptionRegistry.setAction('unsubscribe', 'be-unaware')
      subscriptionRegistry.setAction('multiple_subscriptions', 'too-aware')
      subscriptionRegistry.setAction('not_subscribed', 'unaware')
    })

    it('subscribes to names', () => {
      clientA.socketWrapperMock
        .expects('sendAckMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT,
          action: 'make-aware',
          name: 'someName'
        })

      subscriptionRegistry.subscribe({
        topic: C.TOPIC.EVENT,
        action: 'make-aware',
        name: 'someName'
      }, clientA.socketWrapper)
    })

    it('doesn\'t subscribe twice to the same name', () => {
      clientA.socketWrapperMock
        .expects('sendError')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT
        }, 'too-aware', 'someName')

      subscriptionRegistry.subscribe({
        topic: C.TOPIC.EVENT,
        action: 'too-aware',
        name: 'someName'
      }, clientA.socketWrapper)
      subscriptionRegistry.subscribe({
        topic: C.TOPIC.EVENT,
        action: 'too-aware',
        name: 'someName'
      }, clientA.socketWrapper)
      expect(options.logger.lastLogEvent).toBe('too-aware')
    })

    it('unsubscribes', () => {
      subscriptionRegistry.subscribe({
        topic: C.TOPIC.EVENT,
        action: 'make-aware',
        name: 'someName'
      }, clientA.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendAckMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT,
          action: 'be-unaware',
          name: 'someName'
        })

      subscriptionRegistry.unsubscribe({
        topic: C.TOPIC.EVENT,
        action: 'be-unaware',
        name: 'someName'
      }, clientA.socketWrapper)
    })

    it('handles unsubscribes for non existant subscriptions', () => {
      clientA.socketWrapperMock
        .expects('sendError')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT
        }, 'unaware', 'someName')

      subscriptionRegistry.unsubscribe(unsubscribeMessage, clientA.socketWrapper)
    })
  })

  describe('subscription-registry unbinds all events on unsubscribe', () => {
    it('subscribes and unsubscribes 30 times', () => {
      for (let i = 0; i < 30; i++) {
        subscriptionRegistry.subscribe(subscribeMessage, clientA.socketWrapper)
        subscriptionRegistry.unsubscribe(unsubscribeMessage, clientA.socketWrapper)
      }
    })
  })

})
