import StateRegistry from '../cluster/state-registry'
import {
  EVENT_ACTIONS,
  PRESENCE_ACTIONS,
  RECORD_ACTIONS,
  RPC_ACTIONS,
  TOPIC,
  SubscriptionMessage,
  LOG_LEVEL
} from '../constants'

interface SubscriptionActions {
  MULTIPLE_SUBSCRIPTIONS: RECORD_ACTIONS.MULTIPLE_SUBSCRIPTIONS | EVENT_ACTIONS.MULTIPLE_SUBSCRIPTIONS | RPC_ACTIONS.MULTIPLE_PROVIDERS | PRESENCE_ACTIONS.MULTIPLE_SUBSCRIPTIONS
  NOT_SUBSCRIBED: RECORD_ACTIONS.NOT_SUBSCRIBED | EVENT_ACTIONS.NOT_SUBSCRIBED | RPC_ACTIONS.NOT_PROVIDED | PRESENCE_ACTIONS.NOT_SUBSCRIBED
  SUBSCRIBE: RECORD_ACTIONS.SUBSCRIBE | EVENT_ACTIONS.SUBSCRIBE | RPC_ACTIONS.PROVIDE | PRESENCE_ACTIONS.SUBSCRIBE
  UNSUBSCRIBE: RECORD_ACTIONS.UNSUBSCRIBE | EVENT_ACTIONS.UNSUBSCRIBE | RPC_ACTIONS.UNPROVIDE | PRESENCE_ACTIONS.UNSUBSCRIBE
}

interface Subscription {
  name: string
  sockets: Set<SocketWrapper>
}

export default class SubscriptionRegistry {
  private sockets: Map<SocketWrapper, Set<Subscription>>
  private subscriptions: Map<string, Subscription>
  private config: InternalDeepstreamConfig
  private services: DeepstreamServices
  private topic: TOPIC
  private clusterTopic: TOPIC
  private subscriptionListener: SubscriptionListener
  private constants: SubscriptionActions
  private clusterSubscriptions: StateRegistry
  private actions: any
  private bulkIds = new Set<number>()

  /**
   * A generic mechanism to handle subscriptions from sockets to topics.
   * A bit like an event-hub, only that it registers SocketWrappers rather
   * than functions
   */
  constructor (config: InternalDeepstreamConfig, services: DeepstreamServices, topic: TOPIC, clusterTopic: TOPIC) {
    this.sockets = new Map()
    this.subscriptions = new Map()
    this.config = config
    this.services = services
    this.topic = topic
    this.clusterTopic = clusterTopic

    switch (topic) {
      case TOPIC.RECORD:
        this.actions = RECORD_ACTIONS
        break
      case TOPIC.EVENT:
        this.actions = EVENT_ACTIONS
        break
      case TOPIC.RPC:
        this.actions = RPC_ACTIONS
        break
      case TOPIC.PRESENCE:
        this.actions = PRESENCE_ACTIONS
        break
    }

    this.constants = {
      MULTIPLE_SUBSCRIPTIONS: this.actions.MULTIPLE_SUBSCRIPTIONS,
      NOT_SUBSCRIBED: this.actions.NOT_SUBSCRIBED,
      SUBSCRIBE: this.actions.SUBSCRIBE,
      UNSUBSCRIBE: this.actions.UNSUBSCRIBE,
    }

    this.onSocketClose = this.onSocketClose.bind(this)

    this.setupRemoteComponents(clusterTopic)
    this.setUpBulkHistoryPurge()
  }

  public whenReady (callback: Function): void {
    this.clusterSubscriptions.whenReady(callback)
  }

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  protected setupRemoteComponents (clusterTopic: TOPIC): void {
    this.clusterSubscriptions = this.services.message.getStateRegistry(clusterTopic)
  }

  /**
   * Return all the servers that have this subscription.
   */
  public getAllServers (subscriptionName: string): string[] {
    return this.clusterSubscriptions.getAllServers(subscriptionName)
  }

  /**
   * Return all the servers that have this subscription excluding the current
   * server name
   */
  public getAllRemoteServers (subscriptionName: string): string[] {
    const serverNames = this.clusterSubscriptions.getAllServers(subscriptionName)
    const localServerIndex = serverNames.indexOf(this.config.serverName)
    if (localServerIndex > -1) {
      serverNames.splice(serverNames.indexOf(this.config.serverName), 1)
    }
    return serverNames
  }

  /**
   * Returns a list of all the topic this registry
   * currently has subscribers for
   */
  public getNames (): string[] {
    return this.clusterSubscriptions.getAll()
  }

  /**
   * Returns a map of all the topic this registry
   * currently has subscribers for
   */
  public getNamesMap (): Map<string, number> {
    return this.clusterSubscriptions.getAllMap()
  }

  /**
   * Returns true if the subscription exists somewhere
   * in the cluster
   */
  public hasName (subscriptionName: string): boolean {
    return this.clusterSubscriptions.has(subscriptionName)
  }

  /**
  * This method allows you to customise the SubscriptionRegistry so that it can send
  * custom events and ack messages back.
  * For example, when using the ACTIONS.LISTEN, you would override SUBSCRIBE with
  * ACTIONS.SUBSCRIBE and UNSUBSCRIBE with UNSUBSCRIBE
  */
  public setAction (name: string, value: EVENT_ACTIONS | RECORD_ACTIONS | RPC_ACTIONS): void {
    this.constants[name.toUpperCase()] = value
  }

  /**
   * Enqueues a message string to be broadcast to all subscribers. Broadcasts will potentially
   * be reordered in relation to *other* subscription names, but never in relation to the same
   * subscription name. Each broadcast is given 'broadcastTimeout' ms to coalesce into one big
   * broadcast.
   */
  public sendToSubscribers (name: string, message: Message, noDelay: boolean, senderSocket: SocketWrapper | null, isRemote: boolean = false): void {
    if (senderSocket && !isRemote) {
      this.services.message.send(this.clusterTopic, message)
    }

    const subscription = this.subscriptions.get(name)

    if (!subscription) {
      return
    }

    const subscribers = subscription.sockets
    const first = subscribers.values().next().value
    const msg = first.getMessage(message)
    for (const socket of subscribers) {
      if (socket === senderSocket) {
        continue
      }
      socket.sendBinaryMessage!(msg, true)
    }
  }

  /**
   * Adds a SocketWrapper as a subscriber to a topic
   */
  public subscribe (message: SubscriptionMessage, socket: SocketWrapper, silent?: boolean): void {
    const name = message.name
    const subscription = this.subscriptions.get(name) || {
      name,
      sockets: new Set()
    }

    if (subscription.sockets.size === 0) {
      this.subscriptions.set(name, subscription)
    } else if (subscription.sockets.has(socket)) {
      if (this.services.logger.shouldLog(LOG_LEVEL.WARN)) {
        const msg = `repeat subscription to "${name}" by ${socket.user}`
        this.services.logger.warn(EVENT_ACTIONS[this.constants.MULTIPLE_SUBSCRIPTIONS], msg)
      }
      socket.sendMessage({
        topic: this.topic,
        action: this.constants.MULTIPLE_SUBSCRIPTIONS,
        originalAction: message.action,
        name
      })
      return
    }

    subscription.sockets.add(socket)

    this.addSocket(subscription, socket)

    if (!silent) {
      if (message.isBulk) {
      if (this.bulkIds.has(message.bulkId!)) {
        return
      }
      this.bulkIds.add(message.bulkId!)
      socket.sendAckMessage({
        topic: message.topic,
        action: message.bulkAction as any,
        correlationId: message.correlationId
      })
    } else {
        if (this.services.logger.shouldLog(LOG_LEVEL.DEBUG)) {
          const logMsg = `for ${TOPIC[this.topic]}:${name} by ${socket.user}`
          this.services.logger.debug(this.actions[this.constants.SUBSCRIBE], logMsg)
        }
        socket.sendAckMessage(message)
      }
    }
  }

  /**
   * Removes a SocketWrapper from the list of subscriptions for a topic
   */
  public unsubscribe (message: SubscriptionMessage, socket: SocketWrapper, silent?: boolean): void {
    const name = message.name
    const subscription = this.subscriptions.get(name)

    if (!subscription || !subscription.sockets.delete(socket)) {
      if (!silent) {
        if (this.services.logger.shouldLog(LOG_LEVEL.WARN)) {
          const msg = `${socket.user} is not subscribed to ${name}`
          this.services.logger.warn(this.actions[this.constants.NOT_SUBSCRIBED], msg)
        }
        socket.sendMessage({
          topic: this.topic,
          action: this.constants.NOT_SUBSCRIBED,
          originalAction: message.action,
          name
        })
      }
      return
    }

    this.removeSocket(subscription, socket)

    if (!silent) {
      if (message.isBulk) {
          if (this.bulkIds.has(message.bulkId!)) {
            return
          }
          this.bulkIds.add(message.bulkId!)

          socket.sendAckMessage({
            topic: message.topic,
            action: message.bulkAction as any,
            correlationId: message.correlationId
          })
      } else {
        if (this.services.logger.shouldLog(LOG_LEVEL.DEBUG)) {
          const logMsg = `for ${this.topic}:${name} by ${socket.user}`
          this.services.logger.debug(this.actions[this.constants.UNSUBSCRIBE], logMsg)
        }
        socket.sendAckMessage(message)
      }
    }
  }

  /**
   * Returns an array of SocketWrappers that are subscribed
   * to <name> or null if there are no subscribers
   */
  public getLocalSubscribers (name: string): Set<SocketWrapper> {
    const subscription = this.subscriptions.get(name)
    return subscription ? subscription.sockets : new Set()
  }

  /**
   * Returns true if there are SocketWrappers that
   * are subscribed to <name> or false if there
   * aren't any subscribers
   */
  public hasLocalSubscribers (name: string): boolean {
    return this.subscriptions.has(name)
  }

  /**
   * Allows to set a subscriptionListener after the class had been instantiated
   */
  public setSubscriptionListener (listener: SubscriptionListener): void {
    this.subscriptionListener = listener
    this.clusterSubscriptions.on('add', listener.onFirstSubscriptionMade.bind(listener))
    this.clusterSubscriptions.on('remove', listener.onLastSubscriptionRemoved.bind(listener))
  }

  private addSocket (subscription, socket): void {
    const subscriptions = this.sockets.get(socket) || new Set()
    if (subscriptions.size === 0) {
      this.sockets.set(socket, subscriptions)
      socket.onClose(this.onSocketClose)
    }
    subscriptions.add(subscription)

    this.clusterSubscriptions.add(subscription.name)

    if (this.subscriptionListener) {
      this.subscriptionListener.onSubscriptionMade(subscription.name, socket)
    }
  }

  private removeSocket (subscription, socket): void {
    if (subscription.sockets.size === 0) {
      this.subscriptions.delete(subscription.name)
      socket.removeOnClose(this.onSocketClose)
    }

    if (this.subscriptionListener) {
      this.subscriptionListener.onSubscriptionRemoved(subscription.name, socket)
    }
    this.clusterSubscriptions.remove(subscription.name)

    const subscriptions = this.sockets.get(socket)
    if (subscriptions) {
      subscriptions.delete(subscription)
    } else {
      // log error
    }
  }

  /**
  * Called whenever a socket closes to remove all of its subscriptions
  */
  private onSocketClose (socket: SocketWrapper): void {
    const subscriptions = this.sockets.get(socket)
    if (!subscriptions) {
      this.services.logger.error(EVENT_ACTIONS[this.constants.NOT_SUBSCRIBED], 'A socket has an illegal registered close callback')
      return
    }
    for (const subscription of subscriptions) {
      subscription.sockets.delete(socket)
      this.removeSocket(subscription, socket)
    }
  }

  private setUpBulkHistoryPurge () {
    // This is a really inconvenient way of doing this,
    // specially since it doesn't delete the first X but rather
    // just purges the queue entirely. It's here to prevent a memory
    // leak and will be improved on later, ideally by having a complete
    // status on a bulk message
    setInterval(() => {
      this.bulkIds.clear()
    }, 1000)
  }
}
