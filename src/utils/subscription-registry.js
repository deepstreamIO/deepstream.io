'use strict'

const C = require('../constants/constants')
const DistributedStateRegistry = require('../cluster/distributed-state-registry')
const SocketWrapper = require('../message/socket-wrapper')

class SubscriptionRegistry {
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
    this._delayedBroadcasts = new Map()
    this._delay = -1
    if (options.broadcastTimeout !== undefined) {
      this._delay = options.broadcastTimeout
    }
    this._names = new Map()
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

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  _setupRemoteComponents (clusterTopic) {
    this._clusterSubscriptions = new DistributedStateRegistry(
      clusterTopic ||
      `${this._topic}_${C.TOPIC.SUBSCRIPTIONS}`,
      this._options
    )
    this._clusterSubscriptions.on('add', this._onClusterSubscriptionAdded.bind(this))
    this._clusterSubscriptions.on('remove', this._onClusterSubscriptionRemoved.bind(this))
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

  _onSocketClose (socket) {
    const names = this._names.get(socket) || new Set()
    for (const name of names) {
      this.unsubscribe(name, socket, true)
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
    for (const entry of this._delayedBroadcasts) {
      const name = entry[0]
      const delayedBroadcasts = entry[1]
      const uniqueSenders = delayedBroadcasts.uniqueSenders
      const sharedMessages = delayedBroadcasts.sharedMessages

      if (sharedMessages.length === 0) {
        this._delayedBroadcasts.delete(name)
        continue
      }

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

        if (message) {
          socket.sendNative(message)
        }
      }

      // for all sockets in this subscription name, send either sharedMessage or this socket's
      // specialized message. only sockets that sent something will have a special message, all
      // other sockets are only listeners and receive the exact same (sharedMessage) message.
      const sockets = this._subscriptions.get(name)
      if (sockets) {
        const preparedMessage = SocketWrapper.prepareMessage(sharedMessages)
        for (const socket of sockets) {
          if (!uniqueSenders.has(socket)) {
            socket.sendPrepared(preparedMessage)
          }
        }
        SocketWrapper.finalizeMessage(preparedMessage)
      }

      delayedBroadcasts.uniqueSenders.clear()
      delayedBroadcasts.sharedMessages = ''
    }
  }

  /**
   * Enqueues a message string to be broadcast to all subscribers. Broadcasts will potentially
   * be reordered in relation to *other* subscription names, but never in relation to the same
   * subscription name. Each broadcast is given 'broadcastTimeout' ms to coalesce into one big
   * broadcast.
   *
   * @param   {String} name      the name/topic the subscriber was previously registered for
   * @param   {String} msgString the message as string
   * @param   {[SocketWrapper]} socket an optional socket that shouldn't receive the message
   *
   * @public
   * @returns {void}
   */
  sendToSubscribers (name, msgString, socket) {
    if (!this._subscriptions.has(name)) {
      return
    }

    // not all messages are valid, this should be fixed elsewhere!
    if (msgString.charAt(msgString.length - 1) !== C.MESSAGE_SEPERATOR) {
      msgString += C.MESSAGE_SEPERATOR // eslint-disable-line
    }

    // if not already a delayed broadcast, create it
    let delayedBroadcasts = this._delayedBroadcasts.get(name)
    if (delayedBroadcasts === undefined) {
      delayedBroadcasts = {
        uniqueSenders: new Map(),
        sharedMessages: ''
      }
      this._delayedBroadcasts.set(name, delayedBroadcasts)
    }

    // append this message to the sharedMessage, the message that
    // is shared in the broadcast to every listener-only
    const start = delayedBroadcasts.sharedMessages.length
    delayedBroadcasts.sharedMessages += msgString
    const stop = delayedBroadcasts.sharedMessages.length

    // uniqueSendersMap maps from uuid to offset in uniqueSendersVector
    // each uniqueSender has a vector of "gaps" in relation to sharedMessage
    // sockets should not receive what they sent themselves, so a gap is inserted
    // for every send from this socket
    if (socket && socket.uuid !== undefined) {
      const uniqueSenders = delayedBroadcasts.uniqueSenders
      let gaps = uniqueSenders.get(socket)

      if (!gaps) {
        gaps = []
        uniqueSenders.set(socket, gaps)
      }

      gaps.push(start, stop)
    }

    // reuse the same timer if already started
    if (!this._delayedBroadcastsTimer) {
      if (this._delay !== -1) {
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
    const sockets = this._subscriptions.get(name) || new Set()

    if (sockets.size === 0) {
      this._subscriptions.set(name, sockets)
    } else if (sockets.has(socket)) {
      const msg = `repeat supscription to "${name}" by ${socket.user}`
      this._options.logger.log(C.LOG_LEVEL.WARN, this._constants.MULTIPLE_SUBSCRIPTIONS, msg)
      socket.sendError(this._topic, this._constants.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    sockets.add(socket)

    if (socket.listeners('close').indexOf(this._onSocketClose) === -1) {
      socket.once('close', this._onSocketClose)
    }

    const names = this._names.get(socket) || new Set()
    if (names.size === 0) {
      this._names.set(socket, names)
    }
    names.add(name)

    if (this._subscriptionListener) {
      this._subscriptionListener.onSubscriptionMade(
        name,
        socket,
        sockets.size
      )
    }

    this._clusterSubscriptions.add(name)

    const logMsg = `for ${this._topic}:${name} by ${socket.user}`
    this._options.logger.log(C.LOG_LEVEL.DEBUG, this._constants.SUBSCRIBE, logMsg)
    socket.sendMessage(this._topic, C.ACTIONS.ACK, [this._constants.SUBSCRIBE, name])
  }

  /**
   * Removes a SocketWrapper from the list of subscriptions for a topic
   *
   * @param   {String} name
   * @param   {SocketWrapper} socket
   * @param   {Boolean} silent supresses logs and unsubscribe ACK messages
   *
   * @public
   * @returns {void}
   */
  unsubscribe (name, socket, silent) {
    const sockets = this._subscriptions.get(name)

    if (!sockets || !sockets.has(socket)) {
      const msg = `${socket.user} is not subscribed to ${name}`
      this._options.logger.log(C.LOG_LEVEL.WARN, this._constants.NOT_SUBSCRIBED, msg)
      socket.sendError(this._topic, this._constants.NOT_SUBSCRIBED, name)
      return
    }

    sockets.delete(socket)

    this._clusterSubscriptions.remove(name)

    if (sockets.size === 0) {
      this._subscriptions.delete(name)
    }

    const names = this._names.get(socket)
    names.delete(name)

    if (names.size === 0) {
      this._names.delete(socket)
    }

    if (this._subscriptionListener) {
      this._subscriptionListener.onSubscriptionRemoved(
        name,
        socket,
        sockets.size,
        this.getAllRemoteServers(name).length
      )
    }

    if (!silent) {
      const logMsg = `for ${this._topic}:${name} by ${socket.user}`
      this._options.logger.log(C.LOG_LEVEL.DEBUG, this._constants.UNSUBSCRIBE, logMsg)
      socket.sendMessage(this._topic, C.ACTIONS.ACK, [this._constants.UNSUBSCRIBE, name])
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
    return this._subscriptions.get(name) || new Set()
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
   * @param {SubscriptionListener} subscriptionListener a class exposing a onSubscriptionMade
   *                                                    and onSubscriptionRemoved method
   *
   * @public
   * @returns {void}
   */
  setSubscriptionListener (subscriptionListener) {
    this._subscriptionListener = subscriptionListener
  }

  /**
   * Called when a subscription has been added to the cluster
   * This can be invoked locally or remotely, so we check if it
   * is a local invocation and ignore it if so in favour of the
   * call done from subscribe
   * @param  {String} name the name that was added
   */
  _onClusterSubscriptionAdded (name) {
    if (this._subscriptionListener && !this.hasLocalSubscribers(name)) {
      this._subscriptionListener.onSubscriptionMade(name, null, 1)
    }
  }

  /**
   * Called when a subscription has been removed from the cluster
   * This can be invoked locally or remotely, so we check if it
   * is a local invocation and ignore it if so in favour of the
   * call done from unsubscribe
   * @param  {String} name the name that was removed
   */
  _onClusterSubscriptionRemoved (name) {
    if (this._subscriptionListener && !this.hasLocalSubscribers(name)) {
      this._subscriptionListener.onSubscriptionRemoved(name, null, 0, 0)
    }
  }
}

module.exports = SubscriptionRegistry
