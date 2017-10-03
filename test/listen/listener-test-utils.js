/* eslint-disable class-methods-use-this, max-len */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ListenerRegistry = require('../../src/listen/listener-registry').default
const testHelper = require('../test-helper/test-helper')
const C = require('../../src/constants')
const getTestMocks = require('../test-helper/test-mocks')
const sinon = require('sinon')

const options = testHelper.getDeepstreamOptions()

let topic
let subscribedTopics
const subscribers = new Set()
let clientRegistryMock
let providers
let clients
let listenerRegistry
let clientRegistry

module.exports = class ListenerTestUtils {
  constructor (listenerTopic) {
    topic = listenerTopic || C.TOPIC.RECORD

    subscribedTopics = []

    clientRegistry = {
      hasName (subscriptionName) {
        return subscribedTopics.indexOf(subscriptionName)
      },
      getNames () {
        return subscribedTopics
      },
      getLocalSubscribers () {
        return subscribers
      },
      hasLocalSubscribers () {
        return subscribers.size > 0
      },
      sendToSubscribers: () => {}
    }
    clientRegistryMock = sinon.mock(clientRegistry)

    options.config.listenResponseTimeout = 30
    options.config.shuffleListenProviders = false
    options.config.stateReconciliationTimeout = 10

    clients = [
      null, // to make tests start from 1
      getTestMocks().getSocketWrapper('c1'),
      getTestMocks().getSocketWrapper('c2'),
      getTestMocks().getSocketWrapper('c3')
    ]

    providers = [
      null, // to make tests start from 1
      getTestMocks().getSocketWrapper('p1'),
      getTestMocks().getSocketWrapper('p2'),
      getTestMocks().getSocketWrapper('p3')
    ]

    listenerRegistry = new ListenerRegistry(topic, options.config, options.services, clientRegistry)
    expect(typeof listenerRegistry.handle).toBe('function')
  }

  complete () {
    clients.forEach((client) => {
      if (client) {
        client.socketWrapperMock.verify()
      }
    })
    providers.forEach((provider) => {
      if (provider) {
        provider.socketWrapperMock.verify()
      }
    })
    clientRegistryMock.verify()
  }

  nothingHappened () {
    for (let i = 1; i < 4; i++) {
      this.providerRecievedNoNewMessages(i)
      this.clientDoesNotRecievePublishedUpdate(i)
    }
  }

  /**
  * Provider Utils
  */
  providerListensTo (provider, pattern) {
    providers[provider].socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs({
        topic,
        action: C.ACTIONS.LISTEN,
        name: pattern
      })

    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: C.ACTIONS.LISTEN,
      name: pattern
    })
  }

  providerUnlistensTo (provider, pattern) {
    providers[provider].socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs({
        topic,
        action: C.ACTIONS.UNLISTEN,
        name: pattern
      })

    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: C.ACTIONS.UNLISTEN,
      name: pattern
    })
  }

  providerWillGetSubscriptionFound (provider, pattern, subscription) {
    providers[provider].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic,
        action: C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND,
        name: pattern,
        subscription
      })
  }

  providerWillGetSubscriptionRemoved (provider, pattern, subscription) {
    providers[provider].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic,
        action: C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        name: pattern,
        subscription
      })
  }

  providerAcceptsButIsntAcknowledged (provider, pattern, subscriptionName) {
    this.providerAccepts(provider, pattern, subscriptionName, true)
  }

  providerAccepts (provider, pattern, subscription, doesnthaveActiveProvider) {
    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: C.ACTIONS.LISTEN_ACCEPT,
      name: pattern,
      subscription
    })
    expect(listenerRegistry.hasActiveProvider(subscription)).toBe(!doesnthaveActiveProvider)
  }

  providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed (provider, pattern, subscriptionName) {
    this.providerRejects(provider, pattern, subscriptionName, true)
  }

  providerAcceptsAndIsSentSubscriptionRemoved (provider, pattern, subscriptionName) {
    this.providerWillGetSubscriptionRemoved(provider, pattern, subscriptionName)
    this.providerAcceptsButIsntAcknowledged(provider, pattern, subscriptionName)
  }

  providerRejects (provider, pattern, subscription, doNotCheckActiveProvider) {
    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: C.ACTIONS.LISTEN_REJECT,
      name: pattern,
      subscription
    })

    if (!doNotCheckActiveProvider) {
      expect(listenerRegistry.hasActiveProvider(subscription)).toBe(false)
    }
  }

  acceptMessageThrowsError (provider, pattern, subscription) {
    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: C.ACTIONS.LISTEN_ACCEPT,
      name: pattern,
      subscription
    })
    // TODO
    // verify( providers[ provider], C.ACTIONS.ERROR, [ C.EVENT.INVALID_MESSAGE, C.ACTIONS.LISTEN_ACCEPT, pattern, subscriptionName ] );
  }

  rejectMessageThrowsError (provider, pattern, subscription) {
    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: C.ACTIONS.LISTEN_REJECT,
      name: pattern,
      subscription
    })

    // TODO
    // verify( providers[ provider], C.ACTIONS.ERROR, [ C.EVENT.INVALID_MESSAGE, C.ACTIONS.LISTEN_REJECT, pattern, subscriptionName ] );
  }

  providerLosesItsConnection (provider) {
    providers[provider].socketWrapper.emit('close', providers[provider].socketWrapper)
  }

  /**
  * Subscriber Utils
  */
  subscriptionAlreadyMadeFor (subscriptionName) {
    subscribedTopics.push(subscriptionName)
  }

  clientSubscribesTo (client, subscriptionName, firstSubscription) {
    if (firstSubscription) {
      listenerRegistry.onFirstSubscriptionMade(subscriptionName)
    }
    listenerRegistry.onSubscriptionMade(subscriptionName, clients[client].socketWrapper)
    subscribedTopics.push(subscriptionName)
    subscribers.add(clients[client].socketWrapper)
  }

  clientUnsubscribesTo (client, subscriptionName, lastSubscription) {
    if (lastSubscription) {
      listenerRegistry.onLastSubscriptionRemoved(subscriptionName)
    }
    listenerRegistry.onSubscriptionRemoved(subscriptionName, clients[client].socketWrapper)
    subscribedTopics.splice(subscribedTopics.indexOf(subscriptionName), 1)
    subscribers.delete(clients[client].socketWrapper)
  }

  clientWillRecievePublishedUpdate (client, subscription, state) {
    clients[client].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic,
        action: C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
        name: subscription,
        parsedData: state
      })
  }

  publishUpdateWillBeSentToSubscribers (subscription, state) {
    clientRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(subscription, {
        topic,
        action: C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
        name: subscription,
        parsedData: state
      }, false, null)
  }

  subscriptionHasActiveProvider (subscription, value) {
    expect(listenerRegistry.hasActiveProvider(subscription)).toBe(value)
  }
}
