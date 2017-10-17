import { getMessage } from '../../protocol/text/src/message-builder'
import StateRegistry from '../cluster/state-registry'
import { RECORD_ACTIONS, EVENT_ACTIONS, RPC_ACTIONS, PRESENCE_ACTIONS, TOPIC, EVENT } from '../constants'

let idCounter = 0

interface SubscriptionActions {
  MULTIPLE_SUBSCRIPTIONS: RECORD_ACTIONS.MULTIPLE_SUBSCRIPTIONS | EVENT_ACTIONS.MULTIPLE_SUBSCRIPTIONS | RPC_ACTIONS.MULTIPLE_PROVIDERS | PRESENCE_ACTIONS.MULTIPLE_SUBSCRIPTIONS
  NOT_SUBSCRIBED: RECORD_ACTIONS.NOT_SUBSCRIBED | EVENT_ACTIONS.NOT_SUBSCRIBED | RPC_ACTIONS.NOT_PROVIDED | PRESENCE_ACTIONS.NOT_SUBSCRIBED
  SUBSCRIBE: RECORD_ACTIONS.SUBSCRIBE | EVENT_ACTIONS.SUBSCRIBE | RPC_ACTIONS.PROVIDE | PRESENCE_ACTIONS.SUBSCRIBE
  UNSUBSCRIBE: RECORD_ACTIONS.UNSUBSCRIBE | EVENT_ACTIONS.UNSUBSCRIBE | RPC_ACTIONS.UNPROVIDE | PRESENCE_ACTIONS.UNSUBSCRIBE
}

interface Subscription {
  name: string
  sockets: Set<SocketWrapper>,
  uniqueSenders: Map<SocketWrapper, Array<number>>,
  sharedMessages: string
}

export default class SubscriptionRegistry {
  private pending: Array<Subscription>
  private delay: number
  private sockets: Map<SocketWrapper, Set<Subscription>>
  private subscriptions: Map<string, Subscription>
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private topic: TOPIC
  private subscriptionListener: SubscriptionListener
  private constants: SubscriptionActions
  private clusterSubscriptions: StateRegistry
  private delayedBroadcastsTimer: any
  private actions: any

  /**
   * A generic mechanism to handle subscriptions from sockets to topics.
   * A bit like an event-hub, only that it registers SocketWrappers rather
   * than functions
   */
  constructor (config: DeepstreamConfig, services: DeepstreamServices, topic: TOPIC, clusterTopic: TOPIC) {
    this.pending = []
    this.delay = -1
    if (config.broadcastTimeout !== undefined) {
      this.delay = config.broadcastTimeout
    }
    this.sockets = new Map()
    this.subscriptions = new Map()
    this.config = config
    this.services = services
    this.topic = topic

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

    this.onBroadcastTimeout = this.onBroadcastTimeout.bind(this)
    this.onSocketClose = this.onSocketClose.bind(this)

    this.setupRemoteComponents(clusterTopic)
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
  public getAllServers (subscriptionName: string): Array<string> {
    return this.clusterSubscriptions.getAllServers(subscriptionName)
  }

  /**
   * Return all the servers that have this subscription excluding the current
   * server name
   */
  public getAllRemoteServers (subscriptionName: string): Array<string> {
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
  public getNames (): Array<string> {
    return this.clusterSubscriptions.getAll()
  }

  /**
   * Returns a map of all the topic this registry
   * currently has subscribers for
   */
  public getNamesMap (): Map<string, any> {
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
  public sendToSubscribers (name: string, message: Message, noDelay: boolean, socket: SocketWrapper | null, isRemote: boolean = false): void {
    if (socket && !isRemote) {
      this.services.message.send(message, {})
    }

    const subscription = this.subscriptions.get(name)

    if (!subscription) {
      return
    }

    const msgString = getMessage(message, false)

    if (subscription.sharedMessages.length === 0) {
      this.pending.push(subscription)
    }

    // append this message to the sharedMessage, the message that
    // is shared in the broadcast to every listener-only
    const start = subscription.sharedMessages.length
    subscription.sharedMessages += msgString
    const stop = subscription.sharedMessages.length

    // uniqueSendersMap maps from uuid to offset in uniqueSendersVector
    // each uniqueSender has a vector of "gaps" in relation to sharedMessage
    // sockets should not receive what they sent themselves, so a gap is inserted
    // for every send from this socket
    if (socket && socket.uuid !== undefined) {
      const uniqueSenders = subscription.uniqueSenders
      const gaps = uniqueSenders.get(socket) || []

      if (gaps.length === 0) {
        uniqueSenders.set(socket, gaps)
      }

      gaps.push(start, stop)
    }

    // reuse the same timer if already started
    if (!this.delayedBroadcastsTimer) {
      if (this.delay !== -1 && !noDelay) {
        this.delayedBroadcastsTimer = setTimeout(this.onBroadcastTimeout, this.delay)
      } else {
        this.onBroadcastTimeout()
      }
    }
  }

  /**
   * Adds a SocketWrapper as a subscriber to a topic
   */
  public subscribe (message: Message, socket: SocketWrapper): void {
    const name = message.name
    const subscription = this.subscriptions.get(name) || {
      name,
      sockets: new Set(),
      uniqueSenders: new Map(),
      sharedMessages: '',
    }

    if (subscription.sockets.size === 0) {
      this.subscriptions.set(name, subscription)
    } else if (subscription.sockets.has(socket)) {
      const msg = `repeat supscription to "${name}" by ${socket.user}`
      this.services.logger.warn(EVENT_ACTIONS[this.constants.MULTIPLE_SUBSCRIPTIONS], msg)
      socket.sendError({ topic: this.topic }, this.constants.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    subscription.sockets.add(socket)

    this.addSocket(subscription, socket)

    const logMsg = `for ${TOPIC[this.topic]}:${name} by ${socket.user}`
    this.services.logger.debug(this.actions[this.constants.SUBSCRIBE], logMsg)
    socket.sendAckMessage(message)
  }

  /**
   * Removes a SocketWrapper from the list of subscriptions for a topic
   */
  public unsubscribe (message: Message, socket: SocketWrapper, silent?: boolean): void {
    const name = message.name
    const subscription = this.subscriptions.get(name)

    if (!subscription || !subscription.sockets.delete(socket)) {
      if (!silent) {
        const msg = `${socket.user} is not subscribed to ${name}`
        this.services.logger.warn(this.actions[this.constants.NOT_SUBSCRIBED], msg)
        socket.sendError({ topic: this.topic }, this.constants.NOT_SUBSCRIBED, name)
      }
      return
    }

    this.removeSocket(subscription, socket)

    if (!silent) {
      const logMsg = `for ${this.topic}:${name} by ${socket.user}`
      this.services.logger.debug(this.actions[this.constants.UNSUBSCRIBE], logMsg)
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
    this.clusterSubscriptions.on('add', listener.onFirstSubscriptionMade.bind(listener))
    this.clusterSubscriptions.on('remove', listener.onLastSubscriptionRemoved.bind(listener))
  }

  private addSocket (subscription, socket): void {
    const subscriptions = this.sockets.get(socket) || new Set()
    if (subscriptions.size === 0) {
      this.sockets.set(socket, subscriptions)
      socket.once('close', this.onSocketClose)
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
      const idx = this.pending.indexOf(subscription)
      if (idx !== -1) {
        this.pending.splice(idx, 1)
      }
      socket.removeListener('close', this.onSocketClose)
    } else {
      subscription.uniqueSenders.delete(socket)
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
      // log error
      return
    }
    for (const subscription of subscriptions) {
      subscription.sockets.delete(socket)
      this.removeSocket(subscription, socket)
    }
  }

  /**
   * Broadcasts the enqueued messages for the timed out subscription room.
   */
  private onBroadcastTimeout (): void {
    this.delayedBroadcastsTimer = null

    for (const subscription of this.pending) {
      const uniqueSenders = subscription.uniqueSenders
      const sharedMessages = subscription.sharedMessages
      const sockets = subscription.sockets

      idCounter = (idCounter + 1) % Number.MAX_SAFE_INTEGER

      // for all unique senders and their gaps, build their special messages
      for (const uniqueSender of uniqueSenders) {
        const socket = uniqueSender[0]
        const gaps = uniqueSender[1]
        let i = 0
        let message = sharedMessages.substring(0, gaps[i++])
        let lastStop = gaps[i++]
        while (i < gaps.length) {
          message += sharedMessages.substring(lastStop, gaps[i++])
          lastStop = gaps[i++]
        }
        message += sharedMessages.substring(lastStop, sharedMessages.length)

        socket.__id = idCounter

        if (message) {
          socket.sendNative(message)
        }
      }

      // for all sockets in this subscription name, send either sharedMessage or this socket's
      // specialized message. only sockets that sent something will have a special message, all
      // other sockets are only listeners and receive the exact same (sharedMessage) message.

      // unfortunately accessing the first (or any single) element from a set requires creating
      // an iterator
      const first = sockets.values().next().value
      const preparedMessage = first.prepareMessage(sharedMessages)
      for (const socket of sockets) {
        if (socket.__id !== idCounter) {
          socket.sendPrepared(preparedMessage)
        }
      }
      first.finalizeMessage(preparedMessage)

      subscription.sharedMessages = ''
      subscription.uniqueSenders.clear()
    }

    this.pending.length = 0
  }
}
