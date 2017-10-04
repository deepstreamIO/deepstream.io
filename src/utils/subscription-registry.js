'use strict'

const C = require('../constants/constants')
const messageBuilder = require('../message/message-builder')

let idCounter = 0

module.exports = class SubscriptionRegistry {

  /**
   * A generic mechanism to handle subscriptions from sockets to topics.
   * A bit like an event-hub, only that it registers SocketWrappers rather
   * than functions
   *
   * @constructor
   *
   * @param {Object} options deepstream options
   * @param {String} topic one of C.TOPIC
   * @param {[String]} clusterTopic A unique cluster topic, if not created uses format:
   *                                topic_SUBSCRIPTIONS
   */
  constructor (options, topic, clusterTopic) {
    this._pending = []
    this._delay = -1
    if (options.broadcastTimeout !== undefined) {
      this._delay = options.broadcastTimeout
    }
    this._sockets = new Map()
    this._subscriptions = new Map()
    this._options = options
    this._topic = topic
    this._subscriptionListener = null
    this._constants = {
      MULTIPLE_SUBSCRIPTIONS: C.EVENT.MULTIPLE_SUBSCRIPTIONS,
      SUBSCRIBE: C.ACTIONS.SUBSCRIBE,
      UNSUBSCRIBE: C.ACTIONS.UNSUBSCRIBE,
      NOT_SUBSCRIBED: C.EVENT.NOT_SUBSCRIBED
    }
    this._onBroadcastTimeout = this._onBroadcastTimeout.bind(this)
    this._onSocketClose = this._onSocketClose.bind(this)

    this._setupRemoteComponents(clusterTopic)
  }

  whenReady (callback) {
    this._clusterSubscriptions.whenReady(callback)
  }

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  _setupRemoteComponents (clusterTopic) {
    this._clusterSubscriptions = this._options.message.getStateRegistry(
      clusterTopic || `${this._topic}_${C.TOPIC.SUBSCRIPTIONS}`
    )
  }

  /**
   * Return all the servers that have this subscription.
   *
   * @param  {String} subscriptionName the subscriptionName to look for
   *
   * @public
   * @return {Array}  An array of all the servernames with this subscription
   */
  getAllServers (subscriptionName) {
    return this._clusterSubscriptions.getAllServers(subscriptionName)
  }

  /**
   * Return all the servers that have this subscription excluding the current
   * server name
   *
   * @param  {String} subscriptionName the subscriptionName to look for
   *
   * @public
   * @return {Array}  An array of all the servernames with this subscription
   */
  getAllRemoteServers (subscriptionName) {
    const serverNames = this._clusterSubscriptions.getAllServers(subscriptionName)
    const localServerIndex = serverNames.indexOf(this._options.serverName)
    if (localServerIndex > -1) {
      serverNames.splice(serverNames.indexOf(this._options.serverName), 1)
    }
    return serverNames
  }

  /**
   * Returns a list of all the topic this registry
   * currently has subscribers for
   *
   * @public
   * @returns {Array} names
   */
  getNames () {
    return this._clusterSubscriptions.getAll()
  }

  /**
   * Returns a list of all the topic this registry
   * currently has subscribers for
   *
   * @public
   * @returns {Array} names
   */
  getNamesMap () {
    return this._clusterSubscriptions.getAllMap()
  }

  /**
   * Returns true if the subscription exists somewhere
   * in the cluster
   *
   * @public
   * @returns {Array} names
   */
  hasName (subscriptionName) {
    return this._clusterSubscriptions.has(subscriptionName)
  }

  /**
  * This method allows you to customise the SubscriptionRegistry so that it can send
  * custom events and ack messages back.
  * For example, when using the C.ACTIONS.LISTEN, you would override SUBSCRIBE with
  * C.ACTIONS.SUBSCRIBE and UNSUBSCRIBE with UNSUBSCRIBE
  *
  * @param {string} name The name of the the variable to override. This can be either
  * MULTIPLE_SUBSCRIPTIONS, SUBSCRIBE, UNSUBSCRIBE, NOT_SUBSCRIBED
  *
  * @param {string} value The value to override with.
  *
  * @public
  * @returns {void}
  */
  setAction (name, value) {
    this._constants[name.toUpperCase()] = value
  }

  /**
  * Called whenever a socket closes to remove all of its subscriptions
  * @param {SockerWrapper} the socket that closed
  */
  _onSocketClose (socket) {
    for (const subscription of this._sockets.get(socket)) {
      subscription.sockets.delete(socket)
      this._removeSocket(subscription, socket)
    }
  }

  /**
   * Broadcasts the enqueued messages for the timed out subscription room.
   *
   * @param   {Object} delayedBroadcasts holds information of what messages to send and where
   *
   * @public
   * @returns {void}
   */
  _onBroadcastTimeout () {
    this._delayedBroadcastsTimer = null

    for (const subscription of this._pending) {
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

    this._pending.length = 0
  }

  /**
   * Enqueues a message string to be broadcast to all subscribers. Broadcasts will potentially
   * be reordered in relation to *other* subscription names, but never in relation to the same
   * subscription name. Each broadcast is given 'broadcastTimeout' ms to coalesce into one big
   * broadcast.
   *
   * @param   {String} name      the name/topic the subscriber was previously registered for
   * @param   {String} msgString the message as string
   * @param   {Boolean} noDelay flay to disable broadcast delay for message
   * @param   {[SocketWrapper]} socket an optional socket that shouldn't receive the message
   *
   * @public
   * @returns {void}
   */
  sendToSubscribers (name, message, noDelay, socket) {
    if (socket !== C.SOURCE_MESSAGE_CONNECTOR) {
      this._options.message.send(message.topic, message)
    }

    const subscription = this._subscriptions.get(name)

    if (!subscription) {
      return
    }

    const msgString = messageBuilder.getMsg(message.topic, message.action, message.data)

    // not all messages are valid, this should be fixed elsewhere!
    if (msgString.charAt(msgString.length - 1) !== C.MESSAGE_SEPERATOR) {
      msgString += C.MESSAGE_SEPERATOR // eslint-disable-line
    }

    if (subscription.sharedMessages.length === 0) {
      this._pending.push(subscription)
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
    if (!this._delayedBroadcastsTimer) {
      if (this._delay !== -1 && !noDelay) {
        this._delayedBroadcastsTimer = setTimeout(this._onBroadcastTimeout, this._delay)
      } else {
        this._onBroadcastTimeout()
      }
    }
  }

  /**
   * Adds a SocketWrapper as a subscriber to a topic
   *
   * @param   {String} name
   * @param   {SocketWrapper} socket
   *
   * @public
   * @returns {void}
   */
  subscribe (name, socket) {
    const subscription = this._subscriptions.get(name) || {
      name,
      sockets: new Set(),
      uniqueSenders: new Map(),
      sharedMessages: ''
    }

    if (subscription.sockets.size === 0) {
      this._subscriptions.set(name, subscription)
    } else if (subscription.sockets.has(socket)) {
      const msg = `repeat supscription to "${name}" by ${socket.user}`
      this._options.logger.warn(this._constants.MULTIPLE_SUBSCRIPTIONS, msg)
      socket.sendError(this._topic, this._constants.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    subscription.sockets.add(socket)

    this._addSocket(subscription, socket)

    this._clusterSubscriptions.add(name)

    if (this._subscriptionListener) {
      this._subscriptionListener.onSubscriptionMade(name, socket)
    }

    const logMsg = `for ${this._topic}:${name} by ${socket.user}`
    this._options.logger.debug(this._constants.SUBSCRIBE, logMsg)
    socket.sendMessage(this._topic, C.ACTIONS.ACK, [this._constants.SUBSCRIBE, name], true)
  }

  /**
   * Removes a SocketWrapper from the list of subscriptions for a topic
   *
   * @param   {String} name
   * @param   {SocketWrapper} socket
   *
   * @public
   * @returns {void}
   */
  unsubscribe (name, socket, silent) {
    const subscription = this._subscriptions.get(name)

    if (!subscription || !subscription.sockets.delete(socket)) {
      if (!silent) {
        const msg = `${socket.user} is not subscribed to ${name}`
        this._options.logger.warn(this._constants.NOT_SUBSCRIBED, msg)
        socket.sendError(this._topic, this._constants.NOT_SUBSCRIBED, name)
      }
      return
    }
    this._removeSocket(subscription, socket)

    if (!silent) {
      const logMsg = `for ${this._topic}:${name} by ${socket.user}`
      this._options.logger.debug(this._constants.UNSUBSCRIBE, logMsg)
      socket.sendMessage(this._topic, C.ACTIONS.ACK, [this._constants.UNSUBSCRIBE, name], true)
    }
  }

  /**
   * Returns an array of SocketWrappers that are subscribed
   * to <name> or null if there are no subscribers
   *
   * @param   {String} name
   *
   * @public
   * @returns {Array} SocketWrapper[]
   */
  getLocalSubscribers (name) {
    const subscription = this._subscriptions.get(name)
    return subscription ? subscription.sockets : new Set()
  }

  /**
   * Returns true if there are SocketWrappers that
   * are subscribed to <name> or false if there
   * aren't any subscribers
   *
   * @param   {String}  name
   *
   * @public
   * @returns {Boolean} hasLocalSubscribers
   */
  hasLocalSubscribers (name) {
    return this._subscriptions.has(name)
  }

  /**
   * Allows to set a subscriptionListener after the class had been instantiated
   *
   * @param {SubscriptionListener} listener a class exposing a onSubscriptionMade
   *                                                    and onSubscriptionRemoved method
   *
   * @public
   * @returns {void}
   */
  setSubscriptionListener (listener) {
    this._subscriptionListener = listener
    this._clusterSubscriptions.on('add', listener.onFirstSubscriptionMade.bind(listener))
    this._clusterSubscriptions.on('remove', listener.onLastSubscriptionRemoved.bind(listener))
  }

  _addSocket (subscription, socket) {
    const subscriptions = this._sockets.get(socket) || new Set()
    if (subscriptions.size === 0) {
      this._sockets.set(socket, subscriptions)
      socket.once('close', this._onSocketClose)
    }
    subscriptions.add(subscription)
  }

  _removeSocket (subscription, socket) {
    if (subscription.sockets.size === 0) {
      this._subscriptions.delete(subscription.name)
      const idx = this._pending.indexOf(subscription)
      if (idx !== -1) {
        this._pending.splice(idx, 1)
      }
    } else {
      subscription.uniqueSenders.delete(socket)
    }

    if (this._subscriptionListener) {
      this._subscriptionListener.onSubscriptionRemoved(subscription.name, socket)
    }
    this._clusterSubscriptions.remove(subscription.name)
    const subscriptions = this._sockets.get(socket)
    subscriptions.delete(subscription)
  }
}
