import { TOPIC, ACTIONS, EVENT } from '../constants'
import { getMessage } from '../../protocol/text/src/message-builder'
import StateRegistry from '../cluster/state-registry'

let idCounter = 0

interface constants {
  MULTIPLE_SUBSCRIPTIONS: string
  SUBSCRIBE: string
  UNSUBSCRIBE: string
  NOT_SUBSCRIBED: string
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
  private options: DeepstreamOptions
  private topic: string
  private subscriptionListener: SubscriptionListener
  private constants: constants
  private clusterSubscriptions: StateRegistry
  private delayedBroadcastsTimer: any

  /**
   * A generic mechanism to handle subscriptions from sockets to topics.
   * A bit like an event-hub, only that it registers SocketWrappers rather
   * than functions
   */
  constructor (options: DeepstreamOptions, topic: string, clusterTopic?: string) {
    this.pending = []
    this.delay = -1
    if (options.broadcastTimeout !== undefined) {
      this.delay = options.broadcastTimeout
    }
    this.sockets = new Map()
    this.subscriptions = new Map()
    this.options = options
    this.topic = topic
    this.constants = {
      MULTIPLE_SUBSCRIPTIONS: EVENT.MULTIPLE_SUBSCRIPTIONS,
      SUBSCRIBE: ACTIONS.SUBSCRIBE,
      UNSUBSCRIBE: ACTIONS.UNSUBSCRIBE,
      NOT_SUBSCRIBED: EVENT.NOT_SUBSCRIBED
    }

    this.onBroadcastTimeout = this.onBroadcastTimeout.bind(this)
    this.onSocketClose = this.onSocketClose.bind(this)

    this.setupRemoteComponents(clusterTopic)
  }

  whenReady (callback: Function) : void {
    this.clusterSubscriptions.whenReady(callback)
  }

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  protected setupRemoteComponents (clusterTopic?: string): void {
    this.clusterSubscriptions = this.options.message.getStateRegistry(
      clusterTopic || `${this.topic}_${TOPIC.SUBSCRIPTIONS}`
    )
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
    const localServerIndex = serverNames.indexOf(this.options.serverName)
    if (localServerIndex > -1) {
      serverNames.splice(serverNames.indexOf(this.options.serverName), 1)
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
  *
  * @param {string} name The name of the the variable to override. This can be either
  * MULTIPLE_SUBSCRIPTIONS, SUBSCRIBE, UNSUBSCRIBE, NOT_SUBSCRIBED
  *
  * @param {string} value The value to override with.
  */
  public setAction (name, value): void {
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
      this.options.message.send(message.topic, message)
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
      sharedMessages: ''
    }

    if (subscription.sockets.size === 0) {
      this.subscriptions.set(name, subscription)
    } else if (subscription.sockets.has(socket)) {
      const msg = `repeat supscription to "${name}" by ${socket.user}`
      this.options.logger.warn(this.constants.MULTIPLE_SUBSCRIPTIONS, msg)
      socket.sendError({ topic: this.topic }, this.constants.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    subscription.sockets.add(socket)

    this.addSocket(subscription, socket)

    this.clusterSubscriptions.add(name)

    if (this.subscriptionListener) {
      this.subscriptionListener.onSubscriptionMade(name, socket)
    }

    const logMsg = `for ${this.topic}:${name} by ${socket.user}`
    this.options.logger.debug(this.constants.SUBSCRIBE, logMsg)
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
        this.options.logger.warn(this.constants.NOT_SUBSCRIBED, msg)
        socket.sendError({ topic: this.topic }, this.constants.NOT_SUBSCRIBED, name)
      }
      return
    }

    this.clusterSubscriptions.remove(name)
    this.removeSocket(subscription, socket)

    if (!silent) {
      const logMsg = `for ${this.topic}:${name} by ${socket.user}`
      this.options.logger.debug(this.constants.UNSUBSCRIBE, logMsg)
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
      this.subscriptionListener.onSubscriptionRemoved(subscription, socket)
    }

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
