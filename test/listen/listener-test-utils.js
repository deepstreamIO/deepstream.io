/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let ListenerRegistry = require('../../src/listen/listener-registry'),
  msg = require('../test-helper/test-helper').msg,
  SocketMock = require('../mocks/socket-mock'),
  SocketWrapper = require('../../src/message/socket-wrapper'),
  LoggerMock = require('../mocks/logger-mock'),
  LocalMessageConnector = require('../mocks/local-message-connector'),
  ClusterRegistry = require('../../src/cluster/cluster-registry'),
  UniqueRegistry = require('../../src/cluster/cluster-unique-state-provider'),
  C = require('../../src/constants/constants')

let topic,
  subscribedTopics,
  subscribers = [],
  sendToSubscribersMock,
  providers,
  clients,
  listenerRegistry,
  clientRegistry,
  messageHistory

class ListenerTestUtils {
  constructor(listenerTopic) {
    topic = listenerTopic || C.TOPIC.RECORD
    messageHistory = {}
    sendToSubscribersMock = jasmine.createSpy('sendToSubscribersMock')

    subscribedTopics = []
    clientRegistry = {
      hasName(subscriptionName) {
        return subscribedTopics.indexOf(subscriptionName)
      },
      getNames() {
        return subscribedTopics
      },
      getLocalSubscribers() {
        return subscribers
      },
      hasLocalSubscribers() {
        return subscribers.length > 0
      },
      sendToSubscribers: sendToSubscribersMock
    }

		// TODO Mock process insead
    process.setMaxListeners(0)

    const options = {
      serverName: 'server-name-a',
      stateReconciliationTimeout: 10,
      messageConnector: new LocalMessageConnector(),
      logger: new LoggerMock(),
      listenResponseTimeout: 30
    }
    options.clusterRegistry = new ClusterRegistry(options, {
      getConnectionCount() {}
    })
    options.uniqueRegistry = new UniqueRegistry(options, options.clusterRegistry)

    clients = [
      null, // to make tests start from 1
      new SocketWrapper(new SocketMock(), options),
      new SocketWrapper(new SocketMock(), options),
      new SocketWrapper(new SocketMock(), options)
    ]
    clients[1].toString = function () { return 'c1' }
    clients[2].toString = function () { return 'c2' }
    clients[3].toString = function () { return 'c3' }

    providers = [
      null, // to make tests start from 1
      new SocketWrapper(new SocketMock(), options),
      new SocketWrapper(new SocketMock(), options),
      new SocketWrapper(new SocketMock(), options)
    ]

    providers[1].toString = function () { return 'p1' }
    providers[2].toString = function () { return 'p2' }
    providers[3].toString = function () { return 'p3' }

    listenerRegistry = new ListenerRegistry(topic, options, clientRegistry)
    expect(typeof listenerRegistry.handle).toBe('function')
  }

  nothingHappened() {
    for (let i = 1; i < 4; i++) {
      this.providerRecievedNoNewMessages(i)
      this.clientDoesNotRecievePublishedUpdate(i)
    }
  }

	/**
	* Provider Utils
	*/
  providerListensTo(provider, pattern) {
    updateRegistry(providers[provider], C.ACTIONS.LISTEN, [pattern])
    if (providers[provider].socket.getMsgSize() > 1) {
      verify(providers[provider], [C.ACTIONS.ACK, C.ACTIONS.LISTEN], pattern, 1)
    } else {
      verify(providers[provider], [C.ACTIONS.ACK, C.ACTIONS.LISTEN], pattern)
    }
  }

  providerUnlistensTo(provider, pattern) {
    updateRegistry(providers[provider], C.ACTIONS.UNLISTEN, [pattern])
    verify(providers[provider], [C.ACTIONS.ACK, C.ACTIONS.UNLISTEN], pattern)
  }

  providerGetsSubscriptionFound(provider, pattern, subscription) {
    verify(providers[provider], C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [pattern, subscription])
  }

  providerGetsSubscriptionRemoved(provider, pattern, subscription, negate) {
    verify(providers[provider], C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [pattern, subscription])
  }

  providerAcceptsButIsntAcknowledged(provider, pattern, subscriptionName, doesnthaveActiveProvider) {
    this.providerAccepts(provider, pattern, subscriptionName, true)
  }

  providerAccepts(provider, pattern, subscriptionName, doesnthaveActiveProvider) {
    updateRegistry(providers[provider], C.ACTIONS.LISTEN_ACCEPT, [pattern, subscriptionName])
    expect(listenerRegistry.hasActiveProvider(subscriptionName)).toBe(!doesnthaveActiveProvider)
  }

  providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed(provider, pattern, subscriptionName) {
    this.providerRejects(provider, pattern, subscriptionName, true)
  }

  providerAcceptsAndIsSentSubscriptionRemoved(provider, pattern, subscriptionName) {
    this.providerAcceptsButIsntAcknowledged(provider, pattern, subscriptionName)
    this.providerGetsSubscriptionRemoved(provider, pattern, subscriptionName)
  }

  providerRejects(provider, pattern, subscriptionName, doNotCheckActiveProvider) {
    updateRegistry(providers[provider], C.ACTIONS.LISTEN_REJECT, [pattern, subscriptionName])
    if (!doNotCheckActiveProvider) {
      expect(listenerRegistry.hasActiveProvider(subscriptionName)).toBe(false)
    }
  }

  providerSubscribesTo(provider, subscriptionName) {
    listenerRegistry.onSubscriptionMade(subscriptionName, providers[provider], undefined)
    subscribedTopics.push(subscriptionName)
    subscribers.push(providers[provider])
  }

  providerUnsubscribesTo(provider, subscriptionName, subscriptionCount) {
    listenerRegistry.onSubscriptionRemoved(subscriptionName, providers[provider], subscriptionCount || 0)
    subscribedTopics.splice(subscribedTopics.indexOf(subscriptionName), 1)
    subscribers.splice(subscribers.indexOf(providers[provider]), 1)
  }

  providerRecievedNoNewMessages(provider) {
    verify(providers[provider], null)
  }

  acceptMessageThrowsError(provider, pattern, subscriptionName, doesnthaveActiveProvider) {
    updateRegistry(providers[provider], C.ACTIONS.LISTEN_ACCEPT, [pattern, subscriptionName])
		// TODO
		// verify( providers[ provider], C.ACTIONS.ERROR, [ C.EVENT.INVALID_MESSAGE, C.ACTIONS.LISTEN_ACCEPT, pattern, subscriptionName ] );
  }

  rejectMessageThrowsError(provider, pattern, subscriptionName, doNotCheckActiveProvider) {
    updateRegistry(providers[provider], C.ACTIONS.LISTEN_REJECT, [pattern, subscriptionName])
		// TODO
		// verify( providers[ provider], C.ACTIONS.ERROR, [ C.EVENT.INVALID_MESSAGE, C.ACTIONS.LISTEN_REJECT, pattern, subscriptionName ] );
  }

  providerLosesItsConnection(provider) {
    providers[provider].socket.emit('close')
  }

  providerRecievesPublishedUpdate(provider, subscription, state) {
    verify(providers[provider], C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, [subscription, state ? C.TYPES.TRUE : C.TYPES.FALSE])
  }

	/**
	* Subscriber Utils
	*/
  subscriptionAlreadyMadeFor(subscriptionName) {
    subscribedTopics.push(subscriptionName)
  }

  clientSubscribesToButIsNotFirstSubscriber(client, subscriptionName) {
    listenerRegistry.onSubscriptionMade(subscriptionName, clients[client], 5)
    subscribedTopics.push(subscriptionName)
  }

  clientSubscribesTo(client, subscriptionName, currentSusbcriptions) {
    listenerRegistry.onSubscriptionMade(subscriptionName, clients[client], currentSusbcriptions || 1)
    subscribedTopics.push(subscriptionName)
  }

  clientUnsubscribesAndOnlyRemainingSubscriberIsProvider(client, subscriptionName) {
    listenerRegistry.onSubscriptionRemoved(subscriptionName, clients[client], 1)
  }

  clientUnSubscribesToButIsNotLastSubscriber(client, subscriptionName) {
    this.clientUnsubscribesTo(client, subscriptionName, 1)
  }

  clientUnsubscribesTo(client, subscriptionName, remainingSubscriptions) {
    if (remainingSubscriptions == null) {
      remainingSubscriptions = 0
    }
    listenerRegistry.onSubscriptionRemoved(subscriptionName, clients[client], remainingSubscriptions)
  }

  clientRecievedNoNewMessages(client) {
    verify(clients[client], null)
  }

  clientRecievesPublishedUpdate(client, subscription, state) {
    verify(clients[client], C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER, [subscription, state ? C.TYPES.TRUE : C.TYPES.FALSE])
  }

  clientDoesNotRecievePublishedUpdate(client) {
    this.clientRecievedNoNewMessages(client)
  }

  publishUpdateIsNotSentToSubscribers(subscription) {
    expect(sendToSubscribersMock.calls.count()).toEqual(0)
  }

  publishUpdateSentToSubscribers(subscription, state) {
    const msgString = msg(`${topic}|${C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER}|${subscription}|${state ? C.TYPES.TRUE : C.TYPES.FALSE}+`)
    if (sendToSubscribersMock.calls.mostRecent()) {
      expect(sendToSubscribersMock.calls.mostRecent().args).toEqual([subscription, msgString])
    } else {
      expect('Send to subscribers never called').toEqual(0)
    }
  }

  subscriptionHasActiveProvider(subscription, value) {
    expect(listenerRegistry.hasActiveProvider(subscription)).toBe(value)
  }

}

module.exports = ListenerTestUtils

function updateRegistry(socket, action, data) {
  const message = {
    topic,
    action,
    data,
    raw: msg(`${topic}|${action}|${data.join('|')}+`)
  }
  listenerRegistry.handle(socket, message)
}

function verify(provider, actions, data, messageIndex, negate) {
  var messageIndex = messageIndex || 0
  if (actions == null) {
    const lastMessage = provider.socket.getMsg(0)
    expect(lastMessage).toBe((messageHistory[provider] || {}).message)
    expect(provider.socket.getMsgSize()).toBe((messageHistory[provider] && messageHistory[provider].size) || 0)
    return
  }
  if (!(actions instanceof Array)) {
    actions = [actions]
  }
  if (!(data instanceof Array)) {
    data = [data]
  }
  const message = provider.socket.getMsg(messageIndex)
  messageHistory[provider] = {
    message,
    size: provider.socket.getMsgSize()
  }
  const expectedMessage = msg(`${topic}|${actions.join('|')}|${data.join('|')}+`)
  if (negate) {
    expect(message).not.toBe(expectedMessage)
  } else {
    expect(message).toBe(expectedMessage)
  }
}
