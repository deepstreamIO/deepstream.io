import 'mocha'
import * as sinon from 'sinon'
import {expect} from 'chai'
import * as C from '../../constants'
import * as testHelper from '../../test/helper/test-helper'
import { getTestMocks } from '../../test/helper/test-mocks'
import { SocketWrapper } from '@deepstream/types'
import { DefaultSubscriptionRegistry } from './default-subscription-registry';

const options = testHelper.getDeepstreamOptions()
const services = options.services
const config = options.config

const subscriptionListener = {
  onSubscriptionMade: () => {},
  onSubscriptionRemoved: () => {},
  onLastSubscriptionRemoved: () => {},
  onFirstSubscriptionMade: () => {},
}

let subscriptionRegistry: DefaultSubscriptionRegistry
let subscriptionListenerMock

let clientA: { socketWrapper: SocketWrapper }
let clientB: { socketWrapper: SocketWrapper }

let testMocks

describe('subscription registry', () => {

  beforeEach(() => {
    testMocks = getTestMocks()

    subscriptionListenerMock = sinon.mock(subscriptionListener)
    subscriptionRegistry = new DefaultSubscriptionRegistry({}, services, config, C.TOPIC.EVENT, C.TOPIC.EVENT)
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
    action: C.EVENT_ACTION.SUBSCRIBE,
    name: 'someName'
  }

  const unsubscribeMessage = {
    topic: C.TOPIC.EVENT,
    action: C.EVENT_ACTION.UNSUBSCRIBE,
    name: 'someName'
  }

  const eventMessage = {
    topic: C.TOPIC.EVENT,
    action: C.EVENT_ACTION.EMIT,
    name: 'someName'
  }

  describe('subscription-registry manages subscriptions', () => {
    it('subscribes to names', () => {
      clientA.socketWrapperMock
        .expects('sendAckMessage')
        .once()
        .withExactArgs(subscribeMessage)

      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)

      // expect(socketWrapperA.socket.lastSendMessage).to.equal(_msg('E|A|S|someName+'))

      // subscriptionRegistry.sendToSubscribers('someName', fakeEvent('someName', 'SsomeString'))
      // expect(socketWrapperA.socket.lastSendMessage).to.equal(_msg('E|EVT|someName|SsomeString+'))
    })

    it('doesn\'t subscribe twice to the same name', () => {
      clientA.socketWrapperMock
        .expects('sendAckMessage')
        .once()
        .withExactArgs(subscribeMessage)

      clientA.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT,
          action: C.EVENT_ACTION.MULTIPLE_SUBSCRIPTIONS,
          originalAction: C.EVENT_ACTION.SUBSCRIBE,
          name: 'someName'
        })

      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)
      expect(services.logger.lastLogEvent).to.equal(C.EVENT_ACTION[C.EVENT_ACTION.MULTIPLE_SUBSCRIPTIONS])
    })

    it('returns the subscribed socket', () => {
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)
      expect(subscriptionRegistry.getLocalSubscribers('someName')).to.deep.equal(new Set([clientA.socketWrapper]))
    })

    it('determines if it has subscriptions', () => {
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)
      expect(subscriptionRegistry.hasLocalSubscribers('someName')).to.equal(true)
      expect(subscriptionRegistry.hasLocalSubscribers('someOtherName')).to.equal(false)
    })

    it('distributes messages to multiple subscribers', () => {
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientB.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendBuiltMessage')
        .once()

      clientB.socketWrapperMock
        .expects('sendBuiltMessage')
        .once()

      subscriptionRegistry.sendToSubscribers('someName', eventMessage, true, null)
    })

    it('doesn\'t send message to sender', () => {
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientB.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendBuiltMessage')
        .never()

      clientB.socketWrapperMock
        .expects('sendBuiltMessage')
        .once()

      subscriptionRegistry.sendToSubscribers('someName', eventMessage, false, clientA.socketWrapper)
    })

    it('unsubscribes', () => {
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendAckMessage')
        .once()
        .withExactArgs(unsubscribeMessage)

      subscriptionRegistry.unsubscribe(subscribeMessage.name, unsubscribeMessage, clientA.socketWrapper)
    })

    it('handles unsubscribes for non existant topics', () => {
      clientA.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT,
          action: C.EVENT_ACTION.NOT_SUBSCRIBED,
          originalAction: C.EVENT_ACTION.UNSUBSCRIBE,
          name: 'someName'
        })

      subscriptionRegistry.unsubscribe(subscribeMessage.name, unsubscribeMessage, clientA.socketWrapper)
    })

    it.skip('removes all subscriptions on socket.close', () => {
      subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)
      subscriptionRegistry.subscribe(subscribeMessage.name, Object.assign({}, subscribeMessage, { name: 'eventB' }), clientA.socketWrapper)

      clientA.socketWrapperMock
        .expects('sendMessage')
        .never()

      subscriptionRegistry.sendToSubscribers('nameA', eventMessage, true, null)
      subscriptionRegistry.sendToSubscribers('nameB', eventMessage, true, null)
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

      subscriptionRegistry.subscribe(
        'someName', {
        topic: C.TOPIC.EVENT,
        action: 'make-aware',
        name: 'someName'
      }, clientA.socketWrapper)
    })

    it('doesn\'t subscribe twice to the same name', () => {
      clientA.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT,
          action: 'too-aware',
          originalAction: 'make-aware',
          name: 'someName'
        })

      subscriptionRegistry.subscribe('someName', {
        topic: C.TOPIC.EVENT,
        action: 'make-aware',
        name: 'someName'
      }, clientA.socketWrapper)
      subscriptionRegistry.subscribe('someName', {
        topic: C.TOPIC.EVENT,
        action: 'make-aware',
        name: 'someName'
      }, clientA.socketWrapper)
    })

    it('unsubscribes', () => {
      subscriptionRegistry.subscribe('someName', {
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

      subscriptionRegistry.unsubscribe('someName', {
        topic: C.TOPIC.EVENT,
        action: 'be-unaware',
        name: 'someName'
      }, clientA.socketWrapper)
    })

    it('handles unsubscribes for non existant subscriptions', () => {
      clientA.socketWrapperMock
        .expects('sendMessage')
        .once()
        .withExactArgs({
          topic: C.TOPIC.EVENT,
          action: 'unaware',
          originalAction: 'be-unaware',
          name: 'someName'
        })

      subscriptionRegistry.unsubscribe('someName', {
        topic: C.TOPIC.EVENT,
        action: 'be-unaware',
        name: 'someName'
      }, clientA.socketWrapper)
    })
  })

  describe('subscription-registry unbinds all events on unsubscribe', () => {
    it('subscribes and unsubscribes 30 times', () => {
      for (let i = 0; i < 30; i++) {
        subscriptionRegistry.subscribe(subscribeMessage.name, subscribeMessage, clientA.socketWrapper)
        subscriptionRegistry.unsubscribe(unsubscribeMessage.name, unsubscribeMessage, clientA.socketWrapper)
      }
    })
  })

})
