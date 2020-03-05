import { EVENT_ACTION, RECORD_ACTION, TOPIC, ListenMessage, STATE_REGISTRY_TOPIC } from '../constants'
import { EVENT, SubscriptionListener, DeepstreamConfig, DeepstreamServices, Provider, SocketWrapper, StateRegistry, SubscriptionRegistry } from '@deepstream/types'
import { shuffleArray } from '../utils/utils'

interface ListenInProgress {
  queryProvider: Provider,
  remainingProviders: Provider[]
}

export class ListenerRegistry implements SubscriptionListener {
  private providerRegistry: SubscriptionRegistry
  private uniqueLockName = `${this.topic}_LISTEN_LOCK`
  private patterns = new Map<string, RegExp>()
  private locallyProvidedRecords = new Map<string, Provider>()
  private messageTopic: TOPIC | STATE_REGISTRY_TOPIC
  private actions: typeof RECORD_ACTION | typeof EVENT_ACTION

  private listenInProgress = new Map<string, ListenInProgress>()
  private unsuccesfulMatches = new Map<string, number>()

  private clusterProvidedRecords: StateRegistry
  private rematchInterval!: NodeJS.Timer

  /**
  * Deepstream.io allows clients to register as listeners for subscriptions.
  * This allows for the creation of 'active' data-providers,
  * e.g. data providers that provide data on the fly, based on what clients
  * are actually interested in.
  *
  * When a client registers as a listener, it provides a regular expression.
  * It will then immediatly get a number of callbacks for existing record subscriptions
  * whose names match that regular expression.
  *
  * After that, whenever a record with a name matching that regular expression is subscribed
  * to for the first time, the listener is notified.
  *
  * Whenever the last subscription for a matching record is removed, the listener is also
  * notified with a SUBSCRIPTION_FOR_PATTERN_REMOVED action
  *
  * This class manages the matching of patterns and record names. The subscription /
  * notification logic is handled by this.providerRegistry
  */
  constructor (private topic: TOPIC, private config: DeepstreamConfig, private services: DeepstreamServices, private clientRegistry: SubscriptionRegistry, private metaData: any = {}) {
    this.actions = topic === TOPIC.RECORD ? RECORD_ACTION : EVENT_ACTION

    this.triggerNextProvider = this.triggerNextProvider.bind(this)

    if (this.topic === TOPIC.RECORD) {
      this.providerRegistry = this.services.subscriptions.getSubscriptionRegistry(
        STATE_REGISTRY_TOPIC.RECORD_LISTEN_PATTERNS,
        STATE_REGISTRY_TOPIC.RECORD_LISTEN_PATTERNS,
      )
      this.clusterProvidedRecords = this.services.clusterStates.getStateRegistry(STATE_REGISTRY_TOPIC.RECORD_PUBLISHED_SUBSCRIPTIONS)
      this.messageTopic = STATE_REGISTRY_TOPIC.RECORD_LISTENING
    } else {
      this.providerRegistry = this.services.subscriptions.getSubscriptionRegistry(
        STATE_REGISTRY_TOPIC.EVENT_LISTEN_PATTERNS,
        STATE_REGISTRY_TOPIC.EVENT_LISTEN_PATTERNS,
      )
      this.clusterProvidedRecords = this.services.clusterStates.getStateRegistry(STATE_REGISTRY_TOPIC.EVENT_PUBLISHED_SUBSCRIPTIONS)
      this.messageTopic = STATE_REGISTRY_TOPIC.EVENT_LISTENING
    }

    this.providerRegistry.setAction('subscribe', this.actions.LISTEN)
    this.providerRegistry.setAction('unsubscribe', this.actions.UNLISTEN)
    this.providerRegistry.setSubscriptionListener({
      onLastSubscriptionRemoved: this.removeLastPattern.bind(this),
      onSubscriptionRemoved: this.removePattern.bind(this),
      onFirstSubscriptionMade: this.addPattern.bind(this),
      onSubscriptionMade: this.reconcileSubscriptionsToPatterns.bind(this),
    })

    this.clusterProvidedRecords.onAdd(this.onRecordStartProvided.bind(this))
    this.clusterProvidedRecords.onRemove(this.onRecordStopProvided.bind(this))

    this.services.clusterNode.subscribe(
      this.messageTopic,
      this.onIncomingMessage.bind(this),
    )

    if (this.config.listen.rematchInterval > 1000) {
      this.rematchInterval = setInterval(() => {
        this.patterns.forEach((value, pattern) => this.reconcileSubscriptionsToPatterns(pattern))
      }, this.config.listen.rematchInterval)
    } else {
      this.services.logger.warn(EVENT.INVALID_CONFIG_DATA, 'Setting listen.rematchInterval to less than a second is not permitted.')
    }
  }

  public async close () {
    clearInterval(this.rematchInterval)
  }

  /**
  * Returns whether or not a provider exists for
  * the specific subscriptionName
  */
  public hasActiveProvider (susbcriptionName: string): boolean {
    return this.clusterProvidedRecords.has(susbcriptionName)
  }

  /**
  * The main entry point to the handle class.
  * Called on any of the following actions:
  *
  * 1) ACTIONS.LISTEN
  * 2) ACTIONS.UNLISTEN
  * 3) ACTIONS.LISTEN_ACCEPT
  * 4) ACTIONS.LISTEN_REJECT
  */
  public handle (socketWrapper: SocketWrapper, message: ListenMessage): void {
    if (message.action === this.actions.LISTEN) {
      this.addListener(socketWrapper, message)
      return
    }

    if (message.action === this.actions.UNLISTEN) {
      this.providerRegistry.unsubscribe(message.name, message, socketWrapper)
      return
    }

    if (message.action === this.actions.LISTEN_ACCEPT || message.action === this.actions.LISTEN_REJECT) {
      this.processResponseForListenInProgress(socketWrapper, message)
      return
    }

    this.services.logger.warn(EVENT.UNKNOWN_ACTION, `Unknown action for topic ${TOPIC[message.topic]} action ${message.action}`)
  }

  /**
  * Handle messages that arrive via the message bus
  */
  private onIncomingMessage (message: ListenMessage, serverName: string): void {
    if (message.action === this.actions.LISTEN_UNSUCCESSFUL) {
      if (this.hasActiveProvider(message.subscription) === false) {
        const unsuccesfulTimeStamp = this.unsuccesfulMatches.get(message.subscription)
        if (!unsuccesfulTimeStamp || unsuccesfulTimeStamp - Date.now() > this.config.listen.matchCooldown) {
          this.onFirstSubscriptionMade(message.subscription)
        }
        return
      }
    }
  }

  /**
  * Process an accept or reject for a listen that is currently in progress
  * and hasn't timed out yet.
  */
  private processResponseForListenInProgress (socketWrapper: SocketWrapper, message: ListenMessage): void {
    const inProgress = this.listenInProgress.get(message.subscription)
    if (!inProgress || !inProgress.queryProvider) {
      // This should send a message saying response is invalid
      return
    }
    clearTimeout(inProgress.queryProvider.responseTimeout!)

    if (message.action === this.actions.LISTEN_ACCEPT) {
      this.accept(socketWrapper, message)
      return
    }

    if (message.action === this.actions.LISTEN_REJECT) {
      this.triggerNextProvider(message.subscription)
      return
    }
  }

  /**
  * Called by the record subscription registry whenever a subscription count goes down to zero
  * Part of the subscriptionListener interface.
  */
  public onFirstSubscriptionMade (subscriptionName: string): void {
    this.startProviderSearch(subscriptionName)
  }

  public onSubscriptionMade (subscriptionName: string, socketWrapper: SocketWrapper): void {
    if (this.hasActiveProvider(subscriptionName)) {
      this.sendHasProviderUpdateToSingleSubscriber(true, socketWrapper, subscriptionName)
      return
    }
  }

  public onLastSubscriptionRemoved (subscriptionName: string): void {
    this.unsuccesfulMatches.delete(subscriptionName)

    const provider = this.locallyProvidedRecords.get(subscriptionName)

    if (!provider) {
      return
    }

    this.sendSubscriptionForPatternRemoved(provider, subscriptionName)
    this.removeActiveListener(subscriptionName)
  }

  /**
  * Called by the record subscription registry whenever the subscription count increments.
  * Part of the subscriptionListener interface.
  */
  public onSubscriptionRemoved (subscriptionName: string, socketWrapper: SocketWrapper): void {
  }

  /**
  * Register callback for when the server recieves an accept message from the client
  */
  private accept (socketWrapper: SocketWrapper, message: ListenMessage): void {
    const subscriptionName = message.subscription

    const provider = {
      socketWrapper,
      pattern: message.name,
      closeListener: this.removePattern.bind(this, message.name, socketWrapper)
    }

    this.locallyProvidedRecords.set(subscriptionName, provider)
    socketWrapper.onClose(provider.closeListener)

    this.clusterProvidedRecords.add(subscriptionName)
    this.stopProviderSearch(subscriptionName)
  }

  /**
  * Register a client as a listener for record subscriptions
  */
  private addListener (socketWrapper: SocketWrapper, message: ListenMessage): void {
    const regExp = this.validatePattern(socketWrapper, message)

    if (!regExp) {
      // TODO: Send an invalid pattern here?
      return
    }

    this.providerRegistry.subscribe(message.name, message, socketWrapper)
  }

  /**
  * Find subscriptions that match pattern, and notify them that
  * they can be provided.
  *
  * We will attempt to notify all possible providers rather than
  * just the single provider for load balancing purposes and
  * so that the one listener doesnt potentially get overwhelmed.
  */
  private reconcileSubscriptionsToPatterns (pattern: string, socketWrapper?: SocketWrapper): void {
    const regExp = this.patterns.get(pattern)!
    const names = this.clientRegistry.getNames()

    for (let i = 0; i < names.length; i++) {
      const subscriptionName = names[i]

      if (this.locallyProvidedRecords.has(subscriptionName)) {
        continue
      }

      if (!subscriptionName.match(regExp)) {
        continue
      }

      const listenInProgress = this.listenInProgress.get(subscriptionName)

      if (listenInProgress && socketWrapper) {
        listenInProgress.remainingProviders.push({ socketWrapper, pattern })
      } else if (listenInProgress) {
        // A reconsile happened while listen is still in progress, ignore
      } else {
        this.startProviderSearch(subscriptionName)
      }
    }
  }

  /**
  * Removes the listener if it is the currently active publisher, and retriggers
  * another listener discovery phase
  */
  private removeListenerIfActive (pattern: string, socketWrapper: SocketWrapper): void {
    for (const [subscriptionName, provider] of this.locallyProvidedRecords) {
      if (
        provider.socketWrapper === socketWrapper &&
        provider.pattern === pattern
      ) {
        if (provider.closeListener) {
          provider.socketWrapper.removeOnClose(provider.closeListener)
        }
        this.removeActiveListener(subscriptionName)
        if (this.clientRegistry.hasLocalSubscribers(subscriptionName)) {
          this.startProviderSearch(subscriptionName)
        }
      }
    }
  }

  /**
    */
  private removeActiveListener (subscriptionName: string): void {
    this.clusterProvidedRecords.remove(subscriptionName)
    this.locallyProvidedRecords.delete(subscriptionName)
  }

  /**
  * Start discovery phase once a lock is obtained from the leader within
  * the cluster
  */
  private startProviderSearch (subscriptionName: string): void {
    const localListenArray = this.createLocalListenArray(subscriptionName)

    if (localListenArray.length === 0) {
      return
    }

    this.services.locks.get(this.getUniqueLockName(subscriptionName), (success: boolean) => {
      if (!success) {
        return
      }

      if (this.hasActiveProvider(subscriptionName)) {
        this.services.locks.release(this.getUniqueLockName(subscriptionName))
        return
      }

      this.startLocalDiscoveryStage(subscriptionName, localListenArray)
    })
  }

  /**
  * Start discovery phase once a lock is obtained from the leader within
  * the cluster
  */
  private startLocalDiscoveryStage (subscriptionName: string, localListenArray: Provider[]): void {
    this.services.logger.debug(
      EVENT.LOCAL_LISTEN,
      `started for ${TOPIC[this.topic] || STATE_REGISTRY_TOPIC[this.topic]}:${subscriptionName}`,
      this.metaData,
    )
    this.triggerNextProvider(subscriptionName, localListenArray)
  }

  /**
  * Trigger the next provider in the map of providers capable of publishing
  * data to the specific subscriptionName
  */
 private triggerNextProvider (subscriptionName: string, localListenArray?: Provider[]): void {
  let listenInProgress = this.listenInProgress.get(subscriptionName)
  let provider: Provider

  if (localListenArray) {
    provider = localListenArray.shift()!
    listenInProgress = {
      queryProvider: provider,
      remainingProviders: localListenArray
    }
    this.listenInProgress.set(subscriptionName, listenInProgress)
  } else  if (listenInProgress) {
    if (listenInProgress.remainingProviders.length === 0) {
      this.stopProviderSearch(subscriptionName)
      return
    }

    provider = listenInProgress.remainingProviders.shift()!
    listenInProgress.queryProvider = provider
  } else {
    this.services.logger.warn('triggerNextProvider', 'no listen in progress', this.metaData)
    return
  }

  // const subscribers = this.clientRegistry.getLocalSubscribers(subscriptionName)
  // This stops a client from subscribing to itself, I think
  // if (subscribers && subscribers.has(provider!.socketWrapper)) {
  //   this.services.logger.debug(EVENT.LOCAL_LISTEN, `Ignoring socket since it would be subscribing to itself for ${subscriptionName}`)
  //   this.triggerNextProvider(subscriptionName)
  //   return
  // }

  provider!.responseTimeout = setTimeout(() => {
    provider!.socketWrapper.sendMessage({
      topic: this.topic,
      action: this.actions.LISTEN_RESPONSE_TIMEOUT,
      subscription: subscriptionName
    })
    this.triggerNextProvider(subscriptionName)
  }, this.config.listen.responseTimeout)

  this.sendSubscriptionForPatternFound(provider!, subscriptionName)
}

  /**
  * Finalises a local listener discovery stage
  */
  private stopProviderSearch (subscriptionName: string): void {
    this.services.logger.debug(
      EVENT.LOCAL_LISTEN,
      `stopped for ${TOPIC[this.topic] || STATE_REGISTRY_TOPIC[this.topic]}:${subscriptionName}`,
      this.metaData,
    )

    this.services.locks.release(this.getUniqueLockName(subscriptionName))

    const stoppedSearch = this.listenInProgress.delete(subscriptionName)
    if (stoppedSearch) {
      if (this.hasActiveProvider(subscriptionName) === false) {
        this.unsuccesfulMatches.set(subscriptionName, Date.now())
        this.services.clusterNode.send({
          topic: this.messageTopic,
          action: this.actions.LISTEN_UNSUCCESSFUL,
          subscription: subscriptionName
        })
      }
      return
    }

    this.services.logger.warn(
      EVENT.LOCAL_LISTEN,
      `nothing to stop for ${TOPIC[this.topic] || STATE_REGISTRY_TOPIC[this.topic]}:${subscriptionName}`,
      this.metaData,
    )
  }

  /**
  * Triggered when a subscription is being provided by a node in the cluster
  */
  private onRecordStartProvided (subscriptionName: string): void {
    this.sendHasProviderUpdate(true, subscriptionName)
  }

  /**
  * Triggered when a subscription is stopped being provided by a node in the cluster
  */
  private onRecordStopProvided (subscriptionName: string): void {
    this.services.logger.info(
      'LISTEN_PROVIDER_STOPPED',
      `listen provider has stopped for ${TOPIC[this.topic]}:${subscriptionName}`,
      this.metaData,
    )

    this.sendHasProviderUpdate(false, subscriptionName)
    if (!this.hasActiveProvider(subscriptionName) && this.clientRegistry.hasName(subscriptionName)) {
      this.startProviderSearch(subscriptionName)
    }
  }

  /**
  * Compiles a regular expression from an incoming pattern
  */
  private addPattern (pattern: string): void {
    if (!this.patterns.has(pattern)) {
      this.patterns.set(pattern, new RegExp(pattern))
    }
  }

  /**
  * Deletes the pattern regex when removed
  */
  private removePattern (pattern: string, socketWrapper: SocketWrapper): void {
    this.removeListenerFromInProgress(this.listenInProgress, pattern, socketWrapper)
    this.removeListenerIfActive(pattern, socketWrapper)
  }

  private removeLastPattern (pattern: string): void {
    this.patterns.delete(pattern)
  }

  /**
  * Remove provider from listen in progress map if it unlistens during discovery stage
  */
  private removeListenerFromInProgress (listensCurrentlyInProgress: Map<string, ListenInProgress>, pattern: string, socketWrapper: SocketWrapper): void {
    for (const [subscriptionName, listensInProgress] of listensCurrentlyInProgress) {
      listensInProgress.remainingProviders = listensInProgress.remainingProviders.filter((provider: Provider) => {
        return provider.socketWrapper === socketWrapper && provider.pattern === pattern
      })
      if (listensInProgress.remainingProviders.length === 0) {
        this.stopProviderSearch(subscriptionName)
      }
    }
  }

  /**
  * Sends a has provider update to a single subcriber
  */
  private sendHasProviderUpdateToSingleSubscriber (hasProvider: boolean, socketWrapper: SocketWrapper, subscriptionName: string): void {
    if (socketWrapper && this.topic === TOPIC.RECORD) {
      socketWrapper.sendMessage({
        topic: this.topic,
        action: hasProvider ? RECORD_ACTION.SUBSCRIPTION_HAS_PROVIDER : RECORD_ACTION.SUBSCRIPTION_HAS_NO_PROVIDER,
        name: subscriptionName,
      })
    }
  }

  /**
  * Sends a has provider update to all subcribers
  */
  private sendHasProviderUpdate (hasProvider: boolean, subscriptionName: string): void  {
    if (this.topic !== TOPIC.RECORD) {
      return
    }
    this.clientRegistry.sendToSubscribers(subscriptionName, {
      topic: this.topic,
      action: hasProvider ? RECORD_ACTION.SUBSCRIPTION_HAS_PROVIDER : RECORD_ACTION.SUBSCRIPTION_HAS_NO_PROVIDER,
      name: subscriptionName,
    }, false, null)
  }

  /**
  * Send a subscription found to a provider
  */
  private sendSubscriptionForPatternFound (provider: Provider, subscriptionName: string): void  {
    provider.socketWrapper.sendMessage({
      topic: this.topic,
      action: this.actions.SUBSCRIPTION_FOR_PATTERN_FOUND,
      name: provider.pattern,
      subscription: subscriptionName,
    })
  }

  /**
  * Send a subscription removed to a provider
  */
  private sendSubscriptionForPatternRemoved (provider: Provider, subscriptionName: string): void {
    provider.socketWrapper.sendMessage({
      topic: this.topic,
      action: this.actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
      name: provider.pattern,
      subscription: subscriptionName,
    })
  }

  /**
  * Create a map of all the listeners that patterns match the subscriptionName locally
  */
  private createLocalListenArray (subscriptionName: string): Provider[] {
    const providers: Provider[] = []
    this.patterns.forEach((regex, pattern) => {
      if (regex.test(subscriptionName)) {
        for (const socketWrapper of this.providerRegistry.getLocalSubscribers(pattern)) {
          providers.push({ pattern, socketWrapper })
        }
      }
    })
    if (!this.config.listen.shuffleProviders) {
      return providers
    }
    return shuffleArray(providers)
  }

  /**
  * Validates that the pattern is not empty and is a valid regular expression
  */
  private validatePattern (socketWrapper: SocketWrapper, message: ListenMessage): RegExp | null {
    try {
      return new RegExp(message.name)
    } catch (e) {
      socketWrapper.sendMessage({
        topic: this.topic,
        action: this.actions.INVALID_LISTEN_REGEX,
        name: message.name
      })
      this.services.logger.warn(this.actions[this.actions.INVALID_LISTEN_REGEX], e.toString(), this.metaData)
      return null
    }
  }

  /**
  * Returns the unique lock when leading a listen discovery phase
  */
  private getUniqueLockName (subscriptionName: string) {
    return `${this.uniqueLockName}_${subscriptionName}`
  }
}
