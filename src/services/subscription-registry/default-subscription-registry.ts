import {
  EVENT_ACTION,
  PRESENCE_ACTION,
  RECORD_ACTION,
  RPC_ACTION,
  TOPIC,
  MONITORING_ACTION,
  Message,
  BulkSubscriptionMessage,
  STATE_REGISTRY_TOPIC
} from '../../constants'
import { SocketWrapper, DeepstreamConfig, DeepstreamServices, SubscriptionListener, StateRegistry, SubscriptionRegistry, LOG_LEVEL, EVENT, NamespacedLogger } from '@deepstream/types'

interface SubscriptionActions {
  MULTIPLE_SUBSCRIPTIONS: RECORD_ACTION.MULTIPLE_SUBSCRIPTIONS | EVENT_ACTION.MULTIPLE_SUBSCRIPTIONS | RPC_ACTION.MULTIPLE_PROVIDERS | PRESENCE_ACTION.MULTIPLE_SUBSCRIPTIONS
  NOT_SUBSCRIBED: RECORD_ACTION.NOT_SUBSCRIBED | EVENT_ACTION.NOT_SUBSCRIBED | RPC_ACTION.NOT_PROVIDED | PRESENCE_ACTION.NOT_SUBSCRIBED
  SUBSCRIBE: RECORD_ACTION.SUBSCRIBE | EVENT_ACTION.SUBSCRIBE | RPC_ACTION.PROVIDE | PRESENCE_ACTION.SUBSCRIBE
  UNSUBSCRIBE: RECORD_ACTION.UNSUBSCRIBE | EVENT_ACTION.UNSUBSCRIBE | RPC_ACTION.UNPROVIDE | PRESENCE_ACTION.UNSUBSCRIBE
}

interface Subscription {
  name: string
  sockets: Set<SocketWrapper>
}

export class DefaultSubscriptionRegistry implements SubscriptionRegistry {
  private sockets = new Map<SocketWrapper, Set<Subscription>>()
  private subscriptions = new Map<string, Subscription>()
  private subscriptionListener: SubscriptionListener | null = null
  private constants: SubscriptionActions
  private clusterSubscriptions: StateRegistry
  private actions: any
  private logger: NamespacedLogger = this.services.logger.getNameSpace('SUBSCRIPTION_REGISTRY')
  private invalidSockets = new Set<SocketWrapper>()
  /**
   * A generic mechanism to handle subscriptions from sockets to topics.
   * A bit like an event-hub, only that it registers SocketWrappers rather
   * than functions
   */
  constructor (private pluginConfig: any, private services: Readonly<DeepstreamServices>, private config: Readonly<DeepstreamConfig>, private topic: TOPIC | STATE_REGISTRY_TOPIC, clusterTopic: TOPIC) {
    switch (topic) {
      case TOPIC.RECORD:
      case STATE_REGISTRY_TOPIC.RECORD_LISTEN_PATTERNS:
        this.actions = RECORD_ACTION
        break
      case TOPIC.EVENT:
      case STATE_REGISTRY_TOPIC.EVENT_LISTEN_PATTERNS:
        this.actions = EVENT_ACTION
        break
      case TOPIC.RPC:
        this.actions = RPC_ACTION
        break
      case TOPIC.PRESENCE:
        this.actions = PRESENCE_ACTION
        break
      case TOPIC.MONITORING:
        this.actions = MONITORING_ACTION
        break
    }

    this.constants = {
      MULTIPLE_SUBSCRIPTIONS: this.actions.MULTIPLE_SUBSCRIPTIONS,
      NOT_SUBSCRIBED: this.actions.NOT_SUBSCRIBED,
      SUBSCRIBE: this.actions.SUBSCRIBE,
      UNSUBSCRIBE: this.actions.UNSUBSCRIBE,
    }

    this.onSocketClose = this.onSocketClose.bind(this)

    this.clusterSubscriptions = this.services.clusterStates.getStateRegistry(clusterTopic)

    if (this.pluginConfig.subscriptionsSanityTimer > 0) {
      setInterval(this.illegalCleanup.bind(this), this.pluginConfig.subscriptionsSanityTimer)
      setInterval(() => this.invalidSockets.clear(), this.pluginConfig.subscriptionsSanityTimer * 100)
    }
  }

  public async whenReady () {
    await this.clusterSubscriptions.whenReady()
  }

  public async close () {
    await this.clusterSubscriptions.whenReady()
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
  public setAction (name: string, value: EVENT_ACTION | RECORD_ACTION | RPC_ACTION): void {
    (this.constants as any)[name.toUpperCase()] = value
  }

  /**
   * Enqueues a message string to be broadcast to all subscribers. Broadcasts will potentially
   * be reordered in relation to *other* subscription names, but never in relation to the same
   * subscription name.
   */
  public sendToSubscribers (name: string, message: Message, noDelay: boolean, senderSocket: SocketWrapper | null, suppressRemote: boolean = false): void {
    // If the senderSocket is null it means it was received via the message bus
    if (senderSocket !== null && suppressRemote === false) {
      this.services.clusterNode.send(message)
    }

    const subscription = this.subscriptions.get(name)

    if (!subscription) {
      return
    }

    const subscribers = subscription.sockets

    this.services.monitoring.onBroadcast(message, subscribers.size)

    const serializedMessages: { [index: string]: any } = {}
    for (const socket of subscribers) {
      if (socket === senderSocket) {
        continue
      }
      if (!serializedMessages[socket.socketType]) {
        if (message.parsedData) {
          delete message.data
        }
        this.logger.debug('SEND_TO_SUBSCRIBERS', `encoding ${name} with protocol ${socket.socketType} with data ${JSON.stringify(message)}`)
        serializedMessages[socket.socketType] = socket.getMessage(message)
      }
      this.logger.debug('SEND_TO_SUBSCRIBERS', `sending ${socket.socketType} payload of ${serializedMessages[socket.socketType]}`)
      socket.sendBuiltMessage!(serializedMessages[socket.socketType], !noDelay)
    }
  }

  /**
   * Adds a SocketWrapper as a subscriber to a topic
   */
  public subscribeBulk (message: BulkSubscriptionMessage, socket: SocketWrapper, silent?: boolean): void {
    const length = message.names.length
    for (let i = 0; i < length; i++) {
      this.subscribe(message.names[i], message, socket, true)
    }
    if (!silent) {
      socket.sendAckMessage({
        topic: message.topic,
        action: message.action,
        correlationId: message.correlationId
      })
    }
  }

  /**
   * Adds a SocketWrapper as a subscriber to a topic
   */
  public unsubscribeBulk (message: BulkSubscriptionMessage, socket: SocketWrapper, silent?: boolean): void {
    message.names!.forEach((name) => {
      this.unsubscribe(name, message, socket, true)
    })
    if (!silent) {
      socket.sendAckMessage({
        topic: message.topic,
        action: message.action,
        correlationId: message.correlationId
      })
    }
  }

  /**
   * Adds a SocketWrapper as a subscriber to a topic
   */
  public subscribe (name: string, message: Message, socket: SocketWrapper, silent?: boolean): void {
    const subscription = this.subscriptions.get(name) || {
      name,
      sockets: new Set()
    }

    if (subscription.sockets.size === 0) {
      this.subscriptions.set(name, subscription)
    } else if (subscription.sockets.has(socket)) {
      if (this.logger.shouldLog(LOG_LEVEL.WARN)) {
        const msg = `repeat subscription to "${name}" by ${socket.userId}`
        this.logger.warn(EVENT_ACTION[this.constants.MULTIPLE_SUBSCRIPTIONS], msg, { message, socketWrapper: socket })
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
      if (this.logger.shouldLog(LOG_LEVEL.DEBUG)) {
        const logMsg = `for ${TOPIC[this.topic] || STATE_REGISTRY_TOPIC[this.topic]}:${name} by ${socket.userId}`
        this.logger.debug(this.actions[this.constants.SUBSCRIBE], logMsg)
      }
      socket.sendAckMessage(message)
    }
  }

  /**
   * Removes a SocketWrapper from the list of subscriptions for a topic
   */
  public unsubscribe (name: string, message: Message, socket: SocketWrapper, silent?: boolean): void {
    const subscription = this.subscriptions.get(name)

    if (!subscription || !subscription.sockets.delete(socket)) {
      if (!silent) {
        if (this.logger.shouldLog(LOG_LEVEL.WARN)) {
          const msg = `${socket.userId} is not subscribed to ${name}`
          this.logger.warn(this.actions[this.constants.NOT_SUBSCRIBED], msg, { socketWrapper: socket, message})
        }
        if (STATE_REGISTRY_TOPIC[this.topic]) {
          // This isn't supported for STATE_REGISTRY_TOPIC/s
          return
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
      if (this.logger.shouldLog(LOG_LEVEL.DEBUG)) {
        const logMsg = `for ${this.topic}:${name} by ${socket.userId}`
        this.logger.debug(this.actions[this.constants.UNSUBSCRIBE], logMsg)
      }
      socket.sendAckMessage(message)
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
    this.clusterSubscriptions.onAdd(listener.onFirstSubscriptionMade.bind(listener))
    this.clusterSubscriptions.onRemove(listener.onLastSubscriptionRemoved.bind(listener))
  }

  private addSocket (subscription: Subscription, socket: SocketWrapper): void {
    const subscriptions = this.sockets.get(socket) || new Set()
    if (subscriptions.size === 0) {
      this.sockets.set(socket, subscriptions)
      socket.onClose(this.onSocketClose)
    }
    subscriptions.add(subscription)

    this.clusterSubscriptions!.add(subscription.name)

    if (this.subscriptionListener) {
      this.subscriptionListener.onSubscriptionMade(subscription.name, socket)
    }
  }

  private removeSocket (subscription: Subscription, socket: SocketWrapper): void {
    if (subscription.sockets.size === 0) {
      this.subscriptions.delete(subscription.name)
    }

    if (this.subscriptionListener) {
      this.subscriptionListener.onSubscriptionRemoved(subscription.name, socket)
    }
    this.clusterSubscriptions!.remove(subscription.name)

    const subscriptions = this.sockets.get(socket)
    if (subscriptions) {
      subscriptions.delete(subscription)

      if (subscriptions.size === 0) {
        this.sockets.delete(socket)
        socket.removeOnClose(this.onSocketClose)
      }
    } else {
      this.logger.error(EVENT.ERROR, 'Attempting to delete a subscription that doesn\'t exist')
    }
  }

  /**
  * Called whenever a socket closes to remove all of its subscriptions
  */
  private onSocketClose (socket: SocketWrapper): void {
    const subscriptions = this.sockets.get(socket)
    if (!subscriptions) {
      this.logger.error(
        EVENT_ACTION[this.constants.NOT_SUBSCRIBED],
        'A socket has an illegal registered close callback',
        { socketWrapper: socket }
      )
      return
    }
    for (const subscription of subscriptions) {
      subscription.sockets.delete(socket)
      this.removeSocket(subscription, socket)
    }
    this.sockets.delete(socket)
  }

  private illegalCleanup () {
    this.sockets.forEach((subscriptions, socket) => {
      if (socket.isClosed) {
        if (!this.invalidSockets.has(socket)) {
          this.logger.error(
            EVENT.CLOSED_SOCKET,
            `Socket ${socket.uuid} is closed but still in registry. Currently there are ${this.invalidSockets.size} sockets. If you see this please raise a github issue!`
          )
          this.invalidSockets.add(socket)
        }
      }
    })
  }
}
