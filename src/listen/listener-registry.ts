import StateRegistry from '../cluster/state-registry'
import { EVENT, EVENT_ACTIONS, RECORD_ACTIONS, TOPIC } from '../constants'
import SubscriptionRegistry from '../utils/subscription-registry'
import { shuffleArray } from '../utils/utils'
import TimeoutRegistry from './listener-timeout-registry'

export default class ListenerRegistry implements SubscriptionListener {
  private metaData: any
  private topic: TOPIC
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private providerRegistry: SubscriptionRegistry
  private clientRegistry: SubscriptionRegistry
  private message: Cluster
  private uniqueLockName: string
  private patterns: any
  private localListenInProgress: any
  private listenerTimeoutRegistry: TimeoutRegistry
  private locallyProvidedRecords: any
  private leadListen: any
  private leadingListen: any
  private messageTopic: TOPIC
  private actions: any

  private clusterProvidedRecords: StateRegistry

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
  constructor (topic: TOPIC, config: DeepstreamConfig, services: DeepstreamServices, clientRegistry: SubscriptionRegistry, metaData: any) {
    this.metaData = metaData
    this.topic = topic
    this.actions = topic === TOPIC.RECORD ? RECORD_ACTIONS : EVENT_ACTIONS
    this.config = config
    this.services = services
    this.clientRegistry = clientRegistry
    this.uniqueLockName = `${topic}_LISTEN_LOCK`

    this.message = this.services.message

    this.patterns = {}
    this.localListenInProgress = {}
    this.listenerTimeoutRegistry = new TimeoutRegistry(topic, config, services)

    this.locallyProvidedRecords = {}

    this.leadListen = {}
    this.leadingListen = {}

    this.setupProviderRegistry()
    this.setupRemoteComponents()
  }

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  protected setupProviderRegistry (): void {
    if (this.topic === TOPIC.RECORD) {
      this.providerRegistry = new SubscriptionRegistry(
        this.config,
        this.services,
        this.topic,
        TOPIC.RECORD_LISTEN_PATTERNS,
      )
    } else {
      this.providerRegistry = new SubscriptionRegistry(
        this.config,
        this.services,
        this.topic,
        TOPIC.EVENT_LISTEN_PATTERNS,
      )
    }
    this.providerRegistry.setAction('subscribe', this.actions.LISTEN)
    this.providerRegistry.setAction('unsubscribe', this.actions.UNLISTEN)
    this.providerRegistry.setSubscriptionListener({
      onLastSubscriptionRemoved: this.removeLastPattern.bind(this),
      onSubscriptionRemoved: this.removePattern.bind(this),
      onFirstSubscriptionMade: this.addPattern.bind(this),
      onSubscriptionMade: () => {},
    })
  }

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  protected setupRemoteComponents (): void {
    if (this.topic === TOPIC.RECORD) {
      this.clusterProvidedRecords = this.message.getStateRegistry(TOPIC.RECORD_PUBLISHED_SUBSCRIPTIONS)
      this.messageTopic = TOPIC.RECORD_LISTENING
    } else {
      this.clusterProvidedRecords = this.message.getStateRegistry(TOPIC.EVENT_PUBLISHED_SUBSCRIPTIONS)
      this.messageTopic = TOPIC.EVENT_LISTENING
    }
    this.clusterProvidedRecords.on('add', this.onRecordStartProvided.bind(this))
    this.clusterProvidedRecords.on('remove', this.onRecordStopProvided.bind(this))

    this.message.subscribe(
      this.messageTopic,
      this.onIncomingMessage.bind(this),
    )
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
    const subscriptionName = message.subscription

    if (message.action === this.actions.LISTEN) {
      this.addListener(socketWrapper, message)
      return
    }

    if (message.action === this.actions.UNLISTEN) {
      this.providerRegistry.unsubscribe(message, socketWrapper)
      this.removeListener(socketWrapper, message)
      return
    }

    if (this.listenerTimeoutRegistry.isALateResponder(socketWrapper, message)) {
      this.listenerTimeoutRegistry.handle(socketWrapper, message)
      return
    }

    if (this.localListenInProgress[subscriptionName]) {
      this.processResponseForListenInProgress(socketWrapper, subscriptionName, message)
      return
    }
  }

  /**
  * Handle messages that arrive via the message bus
  *
  * This can either be messages by the leader indicating that this
  * node is responsible for starting a local discovery phase
  * or from a resulting node with an ACK to allow the leader
  * to move on and release its lock
  */
  private onIncomingMessage (message: ListenMessage): void {
    // if (this.config.serverName !== message.data[0]) {
    //   return
    // }
    // if (message.action === ACTIONS.LISTEN) {
    //   this.leadListen[message.data[1]] = message.data[2]
    //   this.startLocalDiscoveryStage(message.data[1])
    // } else if (message.isAck) {
    //   this.nextDiscoveryStage(message.data[1])
    // }
  }

  /**
  * Process an accept or reject for a listen that is currently in progress
  * and hasn't timed out yet.
  */
  private processResponseForListenInProgress (socketWrapper: SocketWrapper, subscriptionName: string, message: ListenMessage): void {
    if (message.action === this.actions.LISTEN_ACCEPT) {
      this.accept(socketWrapper, message)
      this.listenerTimeoutRegistry.rejectLateResponderThatAccepted(subscriptionName)
      this.listenerTimeoutRegistry.clear(subscriptionName)
    } else if (message.action === this.actions.LISTEN_REJECT) {
      const provider = this.listenerTimeoutRegistry.getLateResponderThatAccepted(subscriptionName)
      if (provider) {
        this.accept(provider.socketWrapper, message)
        this.listenerTimeoutRegistry.clear(subscriptionName)
      } else {
        this.triggerNextProvider(subscriptionName)
      }
    }
  }

  /**
  * Called by the record subscription registry whenever a subscription count goes down to zero
  * Part of the subscriptionListener interface.
  */
  public onFirstSubscriptionMade (subscriptionName: string): void {
    this.startDiscoveryStage(subscriptionName)
  }

  public onSubscriptionMade (subscriptionName: string, socketWrapper: SocketWrapper): void {
    if (this.hasActiveProvider(subscriptionName)) {
      this.sendHasProviderUpdateToSingleSubscriber(true, socketWrapper, subscriptionName)
      return
    }
  }

  public onLastSubscriptionRemoved (subscriptionName: string): void {
    const provider = this.locallyProvidedRecords[subscriptionName]

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

    this.listenerTimeoutRegistry.clearTimeout(subscriptionName)

    this.locallyProvidedRecords[subscriptionName] = {
      socketWrapper,
      pattern: message.name,
      closeListener: this.removeListener.bind(this, socketWrapper, message),
    }
    socketWrapper.once('close', this.locallyProvidedRecords[subscriptionName].closeListener)

    this.stopLocalDiscoveryStage(subscriptionName)
    this.clusterProvidedRecords.add(subscriptionName)
  }

  /**
  * Register a client as a listener for record subscriptions
  */
  private addListener (socketWrapper: SocketWrapper, message: ListenMessage): void {
    const regExp = this.validatePattern(socketWrapper, message)

    if (!regExp) {
      return
    }

    this.providerRegistry.subscribe(message, socketWrapper)
    this.reconcileSubscriptionsToPatterns(regExp, message.name, socketWrapper)
  }

  /**
  * Find subscriptions that match pattern, and notify them that
  * they can be provided.
  *
  * We will attempt to notify all possible providers rather than
  * just the single provider for load balancing purposes and
  * so that the one listener doesnt potentially get overwhelmed.
  */
  private reconcileSubscriptionsToPatterns (regExp: RegExp, pattern: string, socketWrapper: SocketWrapper): void {
    const names = this.clientRegistry.getNames()
    for (let i = 0; i < names.length; i++) {
      const subscriptionName = names[i]

      if (this.locallyProvidedRecords[subscriptionName]) {
        continue
      }

      if (!subscriptionName.match(regExp)) {
        continue
      }

      const listenInProgress = this.localListenInProgress[subscriptionName]

      if (listenInProgress) {
        listenInProgress.push({ socketWrapper, pattern })
      } else {
        this.startDiscoveryStage(subscriptionName)
      }
    }
  }

  /**
  * De-register a client as a listener for record subscriptions
  */
  private removeListener (socketWrapper: SocketWrapper, message: Message): void {
    const pattern = message.name
    this.removeListenerFromInProgress(this.localListenInProgress, pattern, socketWrapper)
    this.removeListenerIfActive(pattern, socketWrapper)
  }

  /**
  * Removes the listener if it is the currently active publisher, and retriggers
  * another listener discovery phase
  */
  private removeListenerIfActive (pattern: string, socketWrapper: SocketWrapper): void {
    for (const subscriptionName in this.locallyProvidedRecords) {
      const provider = this.locallyProvidedRecords[subscriptionName]
      if (
        provider.socketWrapper === socketWrapper &&
        provider.pattern === pattern
      ) {
        provider.socketWrapper.removeListener('close', provider.closeListener)
        this.removeActiveListener(subscriptionName)
        if (this.clientRegistry.hasLocalSubscribers(subscriptionName)) {
          this.startDiscoveryStage(subscriptionName)
        }
      }
    }
  }

  /**
    */
  private removeActiveListener (subscriptionName: string): void {
    delete this.locallyProvidedRecords[subscriptionName]
    this.clusterProvidedRecords.remove(subscriptionName)
  }

  /**
  * Start discovery phase once a lock is obtained from the leader within
  * the cluster
  */
  private startDiscoveryStage (subscriptionName: string): void {
    const localListenArray = this.createLocalListenArray(subscriptionName)

    if (localListenArray.length === 0) {
      return
    }

    this.services.uniqueRegistry.get(this.getUniqueLockName(subscriptionName), success => {
      if (!success) {
        return
      }

      if (this.hasActiveProvider(subscriptionName)) {
        this.services.uniqueRegistry.release(this.getUniqueLockName(subscriptionName))
        return
      }

      this.services.logger.debug(
        EVENT.LEADING_LISTEN,
        `started for ${this.topic}:${subscriptionName}`,
        this.metaData,
      )

      const remoteListenArray = this.createRemoteListenArray(subscriptionName)
      this.leadingListen[subscriptionName] = remoteListenArray
      this.startLocalDiscoveryStage(subscriptionName, localListenArray)
    })
  }

  /**
  * called when a subscription has been provided to clear down the discovery stage,
  * or when an ack has been recieved via the message bus
  */
  private nextDiscoveryStage (subscriptionName: string): void {
    if (
      this.hasActiveProvider(subscriptionName) ||
      this.leadingListen[subscriptionName].length === 0
    ) {
      this.services.logger.debug(
        EVENT.LEADING_LISTEN,
        `finished for ${this.topic}:${subscriptionName}`,
        this.metaData,
      )

      delete this.leadingListen[subscriptionName]
      this.services.uniqueRegistry.release(this.getUniqueLockName(subscriptionName))
    } else {
      const nextServerName = this.leadingListen[subscriptionName].shift()
      this.services.logger.debug(
        EVENT.LEADING_LISTEN,
        `started for ${this.topic}:${subscriptionName}`,
        this.metaData,
      )
      this.sendRemoteDiscoveryStart(nextServerName, subscriptionName)
    }
  }

  /**
  * Start discovery phase once a lock is obtained from the leader within
  * the cluster
  */
  private startLocalDiscoveryStage (subscriptionName: string, localListenArray?: Array<Provider>): void {
    if (!localListenArray) {
      localListenArray = this.createLocalListenArray(subscriptionName)
    }

    if (localListenArray.length > 0) {
      this.services.logger.debug(
        EVENT.LOCAL_LISTEN,
        `started for ${this.topic}:${subscriptionName}`,
        this.metaData,
      )
      this.localListenInProgress[subscriptionName] = localListenArray
      this.triggerNextProvider(subscriptionName)
    }
  }

  /**
  * Finalises a local listener discovery stage
  */
  private stopLocalDiscoveryStage (subscriptionName: string): void {
    delete this.localListenInProgress[subscriptionName]

    this.services.logger.debug(
      EVENT.LOCAL_LISTEN,
      `stopped for ${this.topic}:${subscriptionName}`,
      this.metaData,
    )

    if (this.leadingListen[subscriptionName]) {
      this.nextDiscoveryStage(subscriptionName)
    } else if (this.leadListen[subscriptionName]) {
      this.sendRemoteDiscoveryStop(this.leadListen[subscriptionName], subscriptionName)
      delete this.leadListen[subscriptionName]
    } else {
      this.services.logger.warn(
        EVENT.LOCAL_LISTEN,
        `nothing to stop for ${this.topic}:${subscriptionName}`,
        this.metaData,
      )
    }
  }

  /**
  * Trigger the next provider in the map of providers capable of publishing
  * data to the specific subscriptionName
  */
  private triggerNextProvider (subscriptionName: string): void {
    const listenInProgress = this.localListenInProgress[subscriptionName]

    if (typeof listenInProgress === 'undefined') {
      return
    }

    if (listenInProgress.length === 0) {
      this.stopLocalDiscoveryStage(subscriptionName)
      return
    }

    const provider = listenInProgress.shift()
    const subscribers = this.clientRegistry.getLocalSubscribers(subscriptionName)

    if (subscribers && subscribers.has(provider.socketWrapper)) {
      this.stopLocalDiscoveryStage(subscriptionName)
      return
    }

    this.listenerTimeoutRegistry.addTimeout(
      subscriptionName,
      provider,
      this.triggerNextProvider.bind(this),
    )

    this.sendSubscriptionForPatternFound(provider, subscriptionName)
  }

  /**
  * Triggered when a subscription is being provided by a node in the cluster
  */
  private onRecordStartProvided (subscriptionName: string): void {
    this.sendHasProviderUpdate(true, subscriptionName)
    if (this.leadingListen[subscriptionName]) {
      this.nextDiscoveryStage(subscriptionName)
    }
  }

  /**
  * Triggered when a subscription is stopped being provided by a node in the cluster
  */
  private onRecordStopProvided (subscriptionName: string): void {
    this.sendHasProviderUpdate(false, subscriptionName)
    if (
      !this.hasActiveProvider(subscriptionName) &&
      this.clientRegistry.hasName(subscriptionName)
    ) {
      this.startDiscoveryStage(subscriptionName)
    }
  }

  /**
  * Compiles a regular expression from an incoming pattern
  */
  private addPattern (pattern: string): void {
    if (!this.patterns[pattern]) {
      this.patterns[pattern] = new RegExp(pattern)
    }
  }

  /**
  * Deletes the pattern regex when removed
  */
  private removePattern (pattern: string, socketWrapper: SocketWrapper): void {
    this.listenerTimeoutRegistry.removeProvider(socketWrapper)
    this.removeListenerFromInProgress(this.localListenInProgress, pattern, socketWrapper)
    this.removeListenerIfActive(pattern, socketWrapper)
  }

  private removeLastPattern (pattern: string): void {
    delete this.patterns[pattern]
  }

  /**
  * Remove provider from listen in progress map if it unlistens during
  * discovery stage
  */
  private removeListenerFromInProgress (listensCurrentlyInProgress, pattern: string, socketWrapper: SocketWrapper): void {
    for (const subscriptionName in listensCurrentlyInProgress) {
      const listenInProgress = listensCurrentlyInProgress[subscriptionName]
      for (let i = 0; i < listenInProgress.length; i++) {
        if (
          listenInProgress[i].socketWrapper === socketWrapper &&
          listenInProgress[i].pattern === pattern
        ) {
          listenInProgress.splice(i, 1)
        }
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
        action: this.actions.SUBSCRIPTION_HAS_PROVIDER,
        name: subscriptionName,
        parsedData: hasProvider,
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
      action: this.actions.SUBSCRIPTION_HAS_PROVIDER,
      name: subscriptionName,
      parsedData: hasProvider,
    }, false, null)
  }

  /**
  * Sent by the listen leader, and is used to inform the next server in the cluster to
  * start a local discovery
  */
  private sendRemoteDiscoveryStart (serverName: string, subscriptionName: string): void  {
    this.message.sendDirect(serverName, {
      topic: this.messageTopic,
      action: this.actions.LISTEN,
      name: subscriptionName,
    }, this.metaData)
  }

  /**
  * Sent by the listen follower, and is used to inform the leader that it has
  * complete its local discovery start
  */
  private sendRemoteDiscoveryStop (listenLeaderServerName: string, subscriptionName: string): void  {
    this.message.sendDirect(listenLeaderServerName, {
      topic: this.messageTopic,
      action: this.actions.ACK,
      name: subscriptionName,
    }, this.metaData)
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
  private createRemoteListenArray (subscriptionName: string): Array<string> {
    const patterns = this.patterns
    const providerRegistry = this.providerRegistry

    let servers: Array<string> = []
    const providerPatterns = providerRegistry.getNames()

    for (let i = 0; i < providerPatterns.length; i++) {
      const pattern = providerPatterns[i]
      let p = this.patterns[pattern]
      if (p == null) {
        this.services.logger.warn(EVENT.INFO, `can't handle pattern ${pattern}`, this.metaData)
        this.addPattern(pattern)
        p = this.patterns[pattern]
      }
      if (p.test(subscriptionName)) {
        servers = servers.concat(providerRegistry.getAllServers(pattern))
      }
    }

    const set = new Set(servers)
    set.delete(this.config.serverName)

    if (!this.config.shuffleListenProviders) {
      return Array.from(set)
    }
    return shuffleArray(Array.from(set))
  }

  /**
  * Create a map of all the listeners that patterns match the subscriptionName locally
  */
  private createLocalListenArray (subscriptionName): Array<Provider> {
    const patterns = this.patterns
    const providerRegistry = this.providerRegistry
    const providers: Array<Provider> = []
    for (const pattern in patterns) {
      if (patterns[pattern].test(subscriptionName)) {
        for (const socketWrapper of providerRegistry.getLocalSubscribers(pattern)) {
          providers.push({ pattern, socketWrapper })
        }
      }
    }

    if (!this.config.shuffleListenProviders) {
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
      socketWrapper.sendError({ topic: this.topic }, this.actions.INVALID_LISTEN_REGEX)
      this.services.logger.error(this.actions[this.actions.INVALID_LISTEN_REGEX], e.toString(), this.metaData)
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
