import 'mocha'
import { expect } from 'chai'

import { ListenerRegistry } from './listener-registry'
import * as testHelper from '../test/helper/test-helper'
import * as C from '../constants'
import { getTestMocks } from '../test/helper/test-mocks'
import * as sinon from 'sinon'
import { SocketWrapper, SubscriptionRegistry } from '@deepstream/types'
import { TOPIC, ListenMessage } from '../constants'

export default class ListenerTestUtils {
  private actions: any
  private subscribedTopics: string[] = []

  private topic: TOPIC.RECORD | TOPIC.EVENT
  private subscribers = new Set()
  private clientRegistryMock: any
  private providers: Array<{
    socketWrapper: SocketWrapper,
    socketWrapperMock: any
  }>
  private clients: Array<{
    socketWrapper: SocketWrapper,
    socketWrapperMock: any
  }>
  private listenerRegistry: ListenerRegistry
  private clientRegistry: SubscriptionRegistry

  constructor (listenerTopic?: TOPIC.RECORD | TOPIC.EVENT) {
    const { config, services } = testHelper.getDeepstreamOptions()

    this.topic = listenerTopic || C.TOPIC.RECORD

    if (this.topic === C.TOPIC.RECORD) {
      this.actions = C.RECORD_ACTION
    } else {
      this.actions = C.EVENT_ACTION
    }

    const self = this
    this.clientRegistry = {
      hasName (subscriptionName: string) {
        return self.subscribedTopics.indexOf(subscriptionName) === -1
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
    } as never as SubscriptionRegistry
    this.clientRegistryMock = sinon.mock(this.clientRegistry)

    config.listen.responseTimeout = 30
    config.listen.shuffleProviders = false
    // config.stateReconciliationTimeout = 10

    this.clients = [
      // @ts-ignore
      null, // to make tests start from 1
      getTestMocks().getSocketWrapper('c1'),
      getTestMocks().getSocketWrapper('c2'),
      getTestMocks().getSocketWrapper('c3')
    ]

    this.providers = [
      // @ts-ignore
      null, // to make tests start from 1
      getTestMocks().getSocketWrapper('p1'),
      getTestMocks().getSocketWrapper('p2'),
      getTestMocks().getSocketWrapper('p3')
    ]

    this.listenerRegistry = new ListenerRegistry(self.topic, config, services, self.clientRegistry)
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
  public providerListensTo (provider: number, pattern: string): void {
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
      } as never as ListenMessage)
  }

  public providerUnlistensTo (provider: number, pattern: string) {
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
      name: pattern,
    } as never as ListenMessage)
  }

  public providerWillGetListenTimeout (provider: number, subscription: string) {
    this.providers[provider].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: this.topic,
        action: this.actions.LISTEN_RESPONSE_TIMEOUT,
        subscription
      })
  }

  public providerWillGetSubscriptionFound (provider: number, pattern: string, subscription: string) {
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

  public providerWillGetSubscriptionRemoved (provider: number, pattern: string, subscription: string) {
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

  public providerAcceptsButIsntAcknowledged (provider: number, pattern: string, subscriptionName: string) {
    this.providerAccepts(provider, pattern, subscriptionName, true)
  }

  public providerAccepts (provider: number, pattern: string, subscription: string, doesnthaveActiveProvider: boolean) {
    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
      topic: this.topic,
      action: this.actions.LISTEN_ACCEPT,
      name: pattern,
      subscription
    })
    expect(this.listenerRegistry.hasActiveProvider(subscription)).to.equal(!doesnthaveActiveProvider)
  }

  public providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed (provider: number, pattern: string, subscriptionName: string) {
    this.providerRejects(provider, pattern, subscriptionName, true)
  }

  public providerAcceptsAndIsSentSubscriptionRemoved (provider: number, pattern: string, subscriptionName: string) {
    this.providerWillGetSubscriptionRemoved(provider, pattern, subscriptionName)
    this.providerAcceptsButIsntAcknowledged(provider, pattern, subscriptionName)
  }

  public providerRejects (provider: number, pattern: string, subscription: string, doNotCheckActiveProvider: boolean) {
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

  public acceptMessageThrowsError (provider: number, pattern: string, subscription: string) {
    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
      topic: this.topic,
      action: this.actions.LISTEN_ACCEPT,
      name: pattern,
      subscription
    })
    // verify( providers[ provider], this.actions.ERROR, [ C.EVENT.INVALID_MESSAGE, this.actions.LISTEN_ACCEPT, pattern, subscriptionName ] );
  }

  public rejectMessageThrowsError (provider: number, pattern: string, subscription: string) {
    this.listenerRegistry.handle(this.providers[provider].socketWrapper, {
      topic: this.topic,
      action: this.actions.LISTEN_REJECT,
      name: pattern,
      subscription
    })

    // TODO
    // verify( providers[ provider], this.actions.ERROR, [ C.EVENT.INVALID_MESSAGE, this.actions.LISTEN_REJECT, pattern, subscriptionName ] );
  }

  public providerLosesItsConnection (provider: number) {
    // (this.providers[provider].socketWrapper as any).emit('close', this.providers[provider].socketWrapper)
  }

  /**
  * Subscriber Utils
  */
  public subscriptionAlreadyMadeFor (subscriptionName: string) {
    this.subscribedTopics.push(subscriptionName)
  }

  public clientSubscribesTo (client: number, subscriptionName: string, firstSubscription: boolean) {
    if (firstSubscription) {
      this.listenerRegistry.onFirstSubscriptionMade(subscriptionName)
    }
    this.listenerRegistry.onSubscriptionMade(subscriptionName, this.clients[client].socketWrapper)
    this.subscribedTopics.push(subscriptionName)
    this.subscribers.add(this.clients[client].socketWrapper)
  }

  public clientUnsubscribesTo (client: number, subscriptionName: string, lastSubscription: boolean) {
    if (lastSubscription) {
      this.listenerRegistry.onLastSubscriptionRemoved(subscriptionName)
    }
    this.listenerRegistry.onSubscriptionRemoved(subscriptionName, this.clients[client].socketWrapper)
    this.subscribedTopics.splice(this.subscribedTopics.indexOf(subscriptionName), 1)
    this.subscribers.delete(this.clients[client].socketWrapper)
  }

  public clientWillRecievePublishedUpdate (client: number, subscription: string, state: boolean) {
    this.clients[client].socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: this.topic,
        action: state ? this.actions.SUBSCRIPTION_HAS_PROVIDER : this.actions.SUBSCRIPTION_HAS_NO_PROVIDER,
        name: subscription,
      })
  }

  public publishUpdateWillBeSentToSubscribers (subscription: string, state: boolean) {
    this.clientRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(subscription, {
        topic: this.topic,
        action: state ? this.actions.SUBSCRIPTION_HAS_PROVIDER : this.actions.SUBSCRIPTION_HAS_NO_PROVIDER,
        name: subscription,
      }, false, null)
  }

  public subscriptionHasActiveProvider (subscription: string, value: string) {
    expect(this.listenerRegistry.hasActiveProvider(subscription)).to.equal(value)
  }
}
