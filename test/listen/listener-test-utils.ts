const ListenerRegistry = require('../../src/listen/listener-registry').default
const testHelper = require('../test-helper/test-helper')
import * as C from '../../src/constants'
import { getTestMocks } from '../test-helper/test-mocks'
const sinon = require('sinon')

const options = testHelper.getDeepstreamOptions()
const config = options.config
const services = options.services

let topic
let subscribedTopics
const subscribers = new Set()
let clientRegistryMock
let providers
let clients
let listenerRegistry
let clientRegistry

export default class ListenerTestUtils {
  private actions: any

  constructor (listenerTopic?: C.TOPIC) {
    topic = listenerTopic || C.TOPIC.RECORD

    if (topic === C.TOPIC.RECORD) {
      this.actions = C.RECORD_ACTIONS
    } else {
      this.actions = C.EVENT_ACTIONS
    }

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

    config.listenResponseTimeout = 30
    config.shuffleListenProviders = false
    config.stateReconciliationTimeout = 10

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

    listenerRegistry = new ListenerRegistry(topic, config, services, clientRegistry)
    expect(typeof listenerRegistry.handle).toBe('function')
  }

  public complete () {
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

  /**
  * Provider Utils
  */
  public providerListensTo (provider, pattern): void {
    providers[provider].socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs({
        topic,
        action: this.actions.LISTEN,
        name: pattern
      })

    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: this.actions.LISTEN,
      name: pattern
    })
  }

  public providerUnlistensTo (provider, pattern) {
    providers[provider].socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs({
        topic,
        action: this.actions.UNLISTEN,
        name: pattern
      })

    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: this.actions.UNLISTEN,
      name: pattern
    })
  }

  public providerWillGetSubscriptionFound (provider, pattern, subscription) {
    providers[provider].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic,
        action: this.actions.SUBSCRIPTION_FOR_PATTERN_FOUND,
        name: pattern,
        subscription
      })
  }

  public providerWillGetSubscriptionRemoved (provider, pattern, subscription) {
    providers[provider].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic,
        action: this.actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        name: pattern,
        subscription
      })
  }

  public providerAcceptsButIsntAcknowledged (provider, pattern, subscriptionName) {
    this.providerAccepts(provider, pattern, subscriptionName, true)
  }

  public providerAccepts (provider, pattern, subscription, doesnthaveActiveProvider) {
    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: this.actions.LISTEN_ACCEPT,
      name: pattern,
      subscription
    })
    expect(listenerRegistry.hasActiveProvider(subscription)).toBe(!doesnthaveActiveProvider)
  }

  public providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed (provider, pattern, subscriptionName) {
    this.providerRejects(provider, pattern, subscriptionName, true)
  }

  public providerAcceptsAndIsSentSubscriptionRemoved (provider, pattern, subscriptionName) {
    this.providerWillGetSubscriptionRemoved(provider, pattern, subscriptionName)
    this.providerAcceptsButIsntAcknowledged(provider, pattern, subscriptionName)
  }

  public providerRejects (provider, pattern, subscription, doNotCheckActiveProvider) {
    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: this.actions.LISTEN_REJECT,
      name: pattern,
      subscription
    })

    if (!doNotCheckActiveProvider) {
      expect(listenerRegistry.hasActiveProvider(subscription)).toBe(false)
    }
  }

  public acceptMessageThrowsError (provider, pattern, subscription) {
    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: this.actions.LISTEN_ACCEPT,
      name: pattern,
      subscription
    })
    // TODO
    // verify( providers[ provider], this.actions.ERROR, [ C.EVENT.INVALID_MESSAGE, this.actions.LISTEN_ACCEPT, pattern, subscriptionName ] );
  }

  public rejectMessageThrowsError (provider, pattern, subscription) {
    listenerRegistry.handle(providers[provider].socketWrapper, {
      topic,
      action: this.actions.LISTEN_REJECT,
      name: pattern,
      subscription
    })

    // TODO
    // verify( providers[ provider], this.actions.ERROR, [ C.EVENT.INVALID_MESSAGE, this.actions.LISTEN_REJECT, pattern, subscriptionName ] );
  }

  public providerLosesItsConnection (provider) {
    providers[provider].socketWrapper.emit('close', providers[provider].socketWrapper)
  }

  /**
  * Subscriber Utils
  */
  public subscriptionAlreadyMadeFor (subscriptionName) {
    subscribedTopics.push(subscriptionName)
  }

  public clientSubscribesTo (client, subscriptionName, firstSubscription) {
    if (firstSubscription) {
      listenerRegistry.onFirstSubscriptionMade(subscriptionName)
    }
    listenerRegistry.onSubscriptionMade(subscriptionName, clients[client].socketWrapper)
    subscribedTopics.push(subscriptionName)
    subscribers.add(clients[client].socketWrapper)
  }

  public clientUnsubscribesTo (client, subscriptionName, lastSubscription) {
    if (lastSubscription) {
      listenerRegistry.onLastSubscriptionRemoved(subscriptionName)
    }
    listenerRegistry.onSubscriptionRemoved(subscriptionName, clients[client].socketWrapper)
    subscribedTopics.splice(subscribedTopics.indexOf(subscriptionName), 1)
    subscribers.delete(clients[client].socketWrapper)
  }

  public clientWillRecievePublishedUpdate (client, subscription, state) {
    clients[client].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic,
        action: state ? this.actions.SUBSCRIPTION_HAS_PROVIDER : this.actions.SUBSCRIPTION_HAS_NO_PROVIDER,
        name: subscription,
      })
  }

  public publishUpdateWillBeSentToSubscribers (subscription, state) {
    clientRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(subscription, {
        topic,
        action: state ? this.actions.SUBSCRIPTION_HAS_PROVIDER : this.actions.SUBSCRIPTION_HAS_NO_PROVIDER,
        name: subscription,
      }, false, null)
  }

  public subscriptionHasActiveProvider (subscription, value) {
    expect(listenerRegistry.hasActiveProvider(subscription)).toBe(value)
  }
}
