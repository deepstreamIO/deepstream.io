import 'mocha'
import { expect } from 'chai'

import ListenerRegistry from './listener-registry'
import * as testHelper from '../test/helper/test-helper'
import * as C from '../constants'
import { getTestMocks } from '../test/helper/test-mocks'
import * as sinon from 'sinon'

export default class ListenerTestUtils {
  private actions: any
  private subscribedTopics: string[] = []
  private config
  private services

  private topic
  private subscribers = new Set()
  private clientRegistryMock
  private providers
  private clients
  private listenerRegistry
  private clientRegistry

  constructor (listenerTopic?: C.TOPIC) {
    const { config, services } = testHelper.getDeepstreamOptions()
    this.config = config
    this.services = services

    this.topic = listenerTopic || C.TOPIC.RECORD

    if (this.topic === C.TOPIC.RECORD) {
      this.actions = C.RECORD_ACTIONS
    } else {
      this.actions = C.EVENT_ACTIONS
    }

    const self = this
    this.clientRegistry = {
      hasName (subscriptionName: string) {
        return self.subscribedTopics.indexOf(subscriptionName)
      },
      getNames () {
        return self.subscribedTopics
      },
      getLocalSubscribers () {
        return self.subscribers
      },
      hasLocalSubscribers () {
        return self.subscribers.size > 0
      },
      sendToSubscribers: () => {}
    }
    self.clientRegistryMock = sinon.mock(self.clientRegistry)

    config.listenResponseTimeout = 30
    config.shuffleListenProviders = false
    config.stateReconciliationTimeout = 10

    self.clients = [
      null, // to make tests start from 1
      getTestMocks().getSocketWrapper('c1'),
      getTestMocks().getSocketWrapper('c2'),
      getTestMocks().getSocketWrapper('c3')
    ]

    self.providers = [
      null, // to make tests start from 1
      getTestMocks().getSocketWrapper('p1'),
      getTestMocks().getSocketWrapper('p2'),
      getTestMocks().getSocketWrapper('p3')
    ]

    self.listenerRegistry = new ListenerRegistry(self.topic, config, services, self.clientRegistry)
    expect(typeof self.listenerRegistry.handle).to.equal('function')
  }

  public complete () {
    this.clients.forEach((client) => {
      if (client) {
        client.socketWrapperMock.verify()
      }
    })
    this.providers.forEach((provider) => {
      if (provider) {
        provider.socketWrapperMock.verify()
      }
    })
    this.clientRegistryMock.verify()
  }

  /**
  * Provider Utils
  */
  public providerListensTo (provider, pattern): void {
    this.providers[provider].socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs({
        topic: this.topic,
        action: this.actions.LISTEN,
        name: pattern
      })

    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
        topic: this.topic,
        action: this.actions.LISTEN,
        name: pattern
      })
  }

  public providerUnlistensTo (provider, pattern) {
    this.providers[provider].socketWrapperMock
      .expects('sendAckMessage')
      .once()
      .withExactArgs({
        topic: this.topic,
        action: this.actions.UNLISTEN,
        name: pattern
      })

    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
      topic: this.topic,
      action: this.actions.UNLISTEN,
      name: pattern
    })
  }

  public providerWillGetListenTimeout (provider, subscription) {
    this.providers[provider].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: this.topic,
        action: this.actions.LISTEN_RESPONSE_TIMEOUT,
        subscription
      })
  }

  public providerWillGetSubscriptionFound (provider, pattern, subscription) {
    this.providers[provider].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: this.topic,
        action: this.actions.SUBSCRIPTION_FOR_PATTERN_FOUND,
        name: pattern,
        subscription
      })
  }

  public providerWillGetSubscriptionRemoved (provider, pattern, subscription) {
    this.providers[provider].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: this.topic,
        action: this.actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        name: pattern,
        subscription
      })
  }

  public providerAcceptsButIsntAcknowledged (provider, pattern, subscriptionName) {
    this.providerAccepts(provider, pattern, subscriptionName, true)
  }

  public providerAccepts (provider, pattern, subscription, doesnthaveActiveProvider) {
    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
      topic: this.topic,
      action: this.actions.LISTEN_ACCEPT,
      name: pattern,
      subscription
    })
    expect(this.listenerRegistry.hasActiveProvider(subscription)).to.equal(!doesnthaveActiveProvider)
  }

  public providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed (provider, pattern, subscriptionName) {
    this.providerRejects(provider, pattern, subscriptionName, true)
  }

  public providerAcceptsAndIsSentSubscriptionRemoved (provider, pattern, subscriptionName) {
    this.providerWillGetSubscriptionRemoved(provider, pattern, subscriptionName)
    this.providerAcceptsButIsntAcknowledged(provider, pattern, subscriptionName)
  }

  public providerRejects (provider, pattern, subscription, doNotCheckActiveProvider) {
    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
      topic: this.topic,
      action: this.actions.LISTEN_REJECT,
      name: pattern,
      subscription
    })

    if (!doNotCheckActiveProvider) {
      expect(this.listenerRegistry.hasActiveProvider(subscription)).to.equal(false)
    }
  }

  public acceptMessageThrowsError (provider, pattern, subscription) {
    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
      topic: this.topic,
      action: this.actions.LISTEN_ACCEPT,
      name: pattern,
      subscription
    })
    // TODO
    // verify( providers[ provider], this.actions.ERROR, [ C.EVENT.INVALID_MESSAGE, this.actions.LISTEN_ACCEPT, pattern, subscriptionName ] );
  }

  public rejectMessageThrowsError (provider, pattern, subscription) {
    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
      topic: this.topic,
      action: this.actions.LISTEN_REJECT,
      name: pattern,
      subscription
    })

    // TODO
    // verify( providers[ provider], this.actions.ERROR, [ C.EVENT.INVALID_MESSAGE, this.actions.LISTEN_REJECT, pattern, subscriptionName ] );
  }

  public providerLosesItsConnection (provider) {
    this.providers[provider].socketWrapper.emit('close', this.providers[provider].socketWrapper)
  }

  /**
  * Subscriber Utils
  */
  public subscriptionAlreadyMadeFor (subscriptionName) {
    this.subscribedTopics.push(subscriptionName)
  }

  public clientSubscribesTo (client, subscriptionName, firstSubscription) {
    if (firstSubscription) {
      this.listenerRegistry.onFirstSubscriptionMade(subscriptionName)
    }
    this.listenerRegistry.onSubscriptionMade(subscriptionName, this.clients[client].socketWrapper)
    this.subscribedTopics.push(subscriptionName)
    this.subscribers.add(this.clients[client].socketWrapper)
  }

  public clientUnsubscribesTo (client, subscriptionName, lastSubscription) {
    if (lastSubscription) {
      this.listenerRegistry.onLastSubscriptionRemoved(subscriptionName)
    }
    this.listenerRegistry.onSubscriptionRemoved(subscriptionName, this.clients[client].socketWrapper)
    this.subscribedTopics.splice(this.subscribedTopics.indexOf(subscriptionName), 1)
    this.subscribers.delete(this.clients[client].socketWrapper)
  }

  public clientWillRecievePublishedUpdate (client, subscription, state) {
    this.clients[client].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: this.topic,
        action: state ? this.actions.SUBSCRIPTION_HAS_PROVIDER : this.actions.SUBSCRIPTION_HAS_NO_PROVIDER,
        name: subscription,
      })
  }

  public publishUpdateWillBeSentToSubscribers (subscription, state) {
    this.clientRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(subscription, {
        topic: this.topic,
        action: state ? this.actions.SUBSCRIPTION_HAS_PROVIDER : this.actions.SUBSCRIPTION_HAS_NO_PROVIDER,
        name: subscription,
      }, false, null)
  }

  public subscriptionHasActiveProvider (subscription, value) {
    expect(this.listenerRegistry.hasActiveProvider(subscription)).to.equal(value)
  }
}
