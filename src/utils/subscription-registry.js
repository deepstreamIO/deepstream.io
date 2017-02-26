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
   * @param {[String]} clusterTopic A unique cluster topic, if not created uses format: topic_SUBSCRIPTIONS
   */
  constructor(options, topic, clusterTopic) {
    this._delayedBroadcasts = {}
    this._delay = -1
    if (options.broadcastTimeout !== undefined) {
      this._delay = options.broadcastTimeout
    }
    this._subscriptions = {}
    this._options = options
    this._topic = topic
    this._subscriptionListener = null
    this._unsubscribeAllFunctions = []
    this._constants = {
      MULTIPLE_SUBSCRIPTIONS: C.EVENT.MULTIPLE_SUBSCRIPTIONS,
      SUBSCRIBE: C.ACTIONS.SUBSCRIBE,
      UNSUBSCRIBE: C.ACTIONS.UNSUBSCRIBE,
      NOT_SUBSCRIBED: C.EVENT.NOT_SUBSCRIBED
    }

    this._setupRemoteComponents(clusterTopic)
  }

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  _setupRemoteComponents(clusterTopic) {
    this._clusterSubscriptions = new DistributedStateRegistry(clusterTopic || `${this._topic}_${C.TOPIC.SUBSCRIPTIONS}`, this._options)
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
  getAllServers(subscriptionName) {
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
  getAllRemoteServers(subscriptionName) {
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
  getNames() {
    return this._clusterSubscriptions.getAll()
  }

  /**
   * Returns true if the subscription exists somewhere
   * in the cluster
   *
   * @public
   * @returns {Array} names
   */
  hasName(subscriptionName) {
    return this._clusterSubscriptions.getAll().indexOf(subscriptionName) !== -1
  }

  /**
  * This method allows you to customise the SubscriptionRegistry so that it can send custom events and ack messages back.
  * For example, when using the C.ACTIONS.LISTEN, you would override SUBSCRIBE with C.ACTIONS.SUBSCRIBE and UNSUBSCRIBE with UNSUBSCRIBE
  *
  * @param {string} name The name of the the variable to override. This can be either MULTIPLE_SUBSCRIPTIONS, SUBSCRIBE, UNSUBSCRIBE, NOT_SUBSCRIBED
  * @param {string} value The value to override with.
  *
  * @public
  * @returns {void}
  */
  setAction(name, value) {
    this._constants[name.toUpperCase()] = value
  }

  /**
   * Broadcasts the enqueued messages for the timed out subscription room.
   *
   * @param   {Object} delayedBroadcasts holds information of what messages to send and where
   *
   * @public
   * @returns {void}
   */
  onBroadcastTimeout(delayedBroadcasts) {
    const sockets = this._subscriptions[delayedBroadcasts.name]
    if (sockets) {
      // sort vector of unique senders by uuid. doing so in combination with
      // the sorting of the sockets in this subscription name means we can
      // simplify comparisons
      delayedBroadcasts.uniqueSendersVector.sort((a, b) => {
        if (a.sender < b.sender) {
          return -1
        } else if (a.sender > b.sender) {
          return 1
        }
        return 0
      })

      // for all unique senders and their gaps, build their special messages
      for (const uniqueSender of delayedBroadcasts.uniqueSendersVector) {
        uniqueSender.message = delayedBroadcasts.sharedMessages
          .substring(0, uniqueSender.gaps[0].start)
        let lastStop = uniqueSender.gaps[0].stop
        for (let j = 1; j < uniqueSender.gaps.length; j++) {
          uniqueSender.message += delayedBroadcasts.sharedMessages
            .substring(lastStop, uniqueSender.gaps[j].start)
          lastStop = uniqueSender.gaps[j].stop
        }
        uniqueSender.message += delayedBroadcasts.sharedMessages
          .substring(lastStop, delayedBroadcasts.sharedMessages.length)
      }

      // for all sockets in this subscription name, send either sharedMessage or this socket's
      // specialized message. only sockets that sent something will have a special message, all
      // other sockets are only listeners and receive the exact same (sharedMessage) message.
      const preparedMessage = SocketWrapper.prepareMessage(delayedBroadcasts.sharedMessages)
      let j = 0
      for (const socket of sockets) {
        // since both uniqueSendersVector and sockets are sorted by uuid, we can efficiently determine
        // if this socket is a sender in this subscription name or not as well as look up the eventual
        // specialized message for this socket.
        if (j < delayedBroadcasts.uniqueSendersVector.length &&
          delayedBroadcasts.uniqueSendersVector[j].sender === socket.uuid) {
          if (delayedBroadcasts.uniqueSendersVector[j].message.length) {
            socket.sendNative(delayedBroadcasts.uniqueSendersVector[j].message)
          }
          j++
        } else {
          // since we know when a socket is a sender and when it is a listener we can use the optimized prepared
          // message for listeners
          socket.sendPrepared(preparedMessage)
        }
      }
      SocketWrapper.finalizeMessage(preparedMessage)
    }

    // delete this delayed broadcast
    delete this._delayedBroadcasts[delayedBroadcasts.name]
  }

  /**
   * Enqueues a message string to be broadcast to all subscribers. Broadcasts will potentially
   * be reordered in relation to *other* subscription names, but never in relation to the same
   * subscription name. Each broadcast is given 'broadcastTimeout' ms to coalesce into one big
   * broadcast.
   *
   * @param   {String} name      the name/topic the subscriber was previously registered for
   * @param   {String} msgString the message as string
   * @param   {[SocketWrapper]} sender an optional socketWrapper that shouldn't receive the message
   *
   * @public
   * @returns {void}
   */
  sendToSubscribers(name, msgString, sender) {
    if (!this._subscriptions[name]) {
      return
    }

    // not all messages are valid, this should be fixed elsewhere!
    if (msgString.charAt(msgString.length - 1) !== C.MESSAGE_SEPERATOR) {
      msgString += C.MESSAGE_SEPERATOR
    }

    // if not already a delayed broadcast, create it
    let delayedBroadcasts = this._delayedBroadcasts[name]
    if (delayedBroadcasts === undefined) {
      this._delayedBroadcasts[name] = delayedBroadcasts = {
        uniqueSendersVector: [],
        uniqueSendersMap: {},
        timer: null,
        name,
        sharedMessages: ''
      }
    }

    // append this message to the sharedMessage, the message that
    // is shared in the broadcast to every listener-only
    const start = delayedBroadcasts.sharedMessages.length
    delayedBroadcasts.sharedMessages += msgString
    const stop = delayedBroadcasts.sharedMessages.length

    // uniqueSendersMap maps from uuid to offset in uniqueSendersVector
    // each uniqueSender has a vector of "gaps" in relation to sharedMessage
    // senders should not receive what they sent themselves, so a gap is inserted
    // for every send from this sender
    let pos
    if (sender && sender.uuid !== undefined) {
      pos = delayedBroadcasts.uniqueSendersMap[sender.uuid]
      if (pos !== undefined) {
        delayedBroadcasts.uniqueSendersVector[pos].gaps.push({ start, stop })
      } else {
        pos = delayedBroadcasts.uniqueSendersVector.length
        delayedBroadcasts.uniqueSendersMap[sender.uuid] = pos
        delayedBroadcasts.uniqueSendersVector[pos] = {
          sender: sender.uuid,
          message: null,
          gaps: [{ start, stop }]
        }
      }
    }

    // reuse the same timer if already started
    if (!delayedBroadcasts.timer) {
      if (this._delay !== -1) {
        delayedBroadcasts.timer = setTimeout(this.onBroadcastTimeout.bind(this), this._delay, delayedBroadcasts)
      } else {
        this.onBroadcastTimeout(delayedBroadcasts)
      }
    }
  }

  /**
   * Adds a SocketWrapper as a subscriber to a topic
   *
   * @param   {String} name
   * @param   {SocketWrapper} socketWrapper
   *
   * @public
   * @returns {void}
   */
  subscribe(name, socketWrapper) {
    if (this._subscriptions[name] === undefined) {
      this._subscriptions[name] = []
    }

    if (this._subscriptions[name].indexOf(socketWrapper) !== -1) {
      const msg = `repeat supscription to "${name}" by ${socketWrapper.user}`
      this._options.logger.log(C.LOG_LEVEL.WARN, this._constants.MULTIPLE_SUBSCRIPTIONS, msg)
      socketWrapper.sendError(this._topic, this._constants.MULTIPLE_SUBSCRIPTIONS, name)
      return
    }

    if (!this.isLocalSubscriber(socketWrapper)) {
      const unsubscribeAllFn = this.unsubscribeAll.bind(this, socketWrapper)
      this._unsubscribeAllFunctions.push({
        socketWrapper,
        fn: unsubscribeAllFn
      })
      socketWrapper.once('close', unsubscribeAllFn)
    }

    // insert socket in vector, sorted by uuid
    const sorted = this._subscriptions[name]
    let index = 0
    for (; index < sorted.length; index++) {
      if (sorted[index].uuid > socketWrapper.uuid) {
        break
      }
    }
    sorted.splice(index, 0, socketWrapper)

    if (this._subscriptionListener) {
      this._subscriptionListener.onSubscriptionMade(
        name,
        socketWrapper,
        this._subscriptions[name].length
      )
    }

    this._clusterSubscriptions.add(name)

    const logMsg = `for ${this._topic}:${name} by ${socketWrapper.user}`
    this._options.logger.log(C.LOG_LEVEL.DEBUG, this._constants.SUBSCRIBE, logMsg)
    socketWrapper.sendMessage(this._topic, C.ACTIONS.ACK, [this._constants.SUBSCRIBE, name])
  }

  /**
   * Removes a SocketWrapper from the list of subscriptions for a topic
   *
   * @param   {String} name
   * @param   {SocketWrapper} socketWrapper
   * @param   {Boolean} silent supresses logs and unsubscribe ACK messages
   *
   * @public
   * @returns {void}
   */
  unsubscribe(name, socketWrapper, silent) {
    let msg
    let i

    if (this._subscriptions[name] === undefined ||
      this._subscriptions[name].indexOf(socketWrapper) === -1) {
      msg = `${socketWrapper.user} is not subscribed to ${name}`
      this._options.logger.log(C.LOG_LEVEL.WARN, this._constants.NOT_SUBSCRIBED, msg)
      socketWrapper.sendError(this._topic, this._constants.NOT_SUBSCRIBED, name)
      return
    }

    this._clusterSubscriptions.remove(name)

    if (this._subscriptions[name].length === 1) {
      delete this._subscriptions[name]
    } else {
      this._subscriptions[name].splice(this._subscriptions[name].indexOf(socketWrapper), 1)
    }

    if (this._subscriptionListener) {
      const allServerNames = this._clusterSubscriptions.getAllServers(name)
      const indexOfCurrentNode = allServerNames.indexOf(this._options.serverName)
      if (indexOfCurrentNode > -1) {
        allServerNames.splice(indexOfCurrentNode, 1)
      }
      this._subscriptionListener.onSubscriptionRemoved(
        name,
        socketWrapper,
        this._subscriptions[name] ? this._subscriptions[name].length : 0,
        allServerNames.length
      )
    }

    if (!silent) {
      const logMsg = `for ${this._topic}:${name} by ${socketWrapper.user}`
      this._options.logger.log(C.LOG_LEVEL.DEBUG, this._constants.UNSUBSCRIBE, logMsg)
      socketWrapper.sendMessage(this._topic, C.ACTIONS.ACK, [this._constants.UNSUBSCRIBE, name])
    }

    if (!this.isLocalSubscriber(socketWrapper)) {
      for (i = 0; i < this._unsubscribeAllFunctions.length; i++) {
        if (this._unsubscribeAllFunctions[i].socketWrapper === socketWrapper) {
          socketWrapper.removeListener('close', this._unsubscribeAllFunctions[i].fn)
          this._unsubscribeAllFunctions.splice(i, 1)
        }
      }
    }
  }

  /**
   * Removes the SocketWrapper from all subscriptions. This is also called
   * when the socket closes
   *
   * @param   {SocketWrapper} socketWrapper
   *
   * @public
   * @returns {void}
   */
  unsubscribeAll(socketWrapper) {
    let name
    let index

    for (name in this._subscriptions) {
      index = this._subscriptions[name].indexOf(socketWrapper)

      if (index !== -1) {
        this.unsubscribe(name, socketWrapper)
      }
    }
  }

  /**
   * Returns true if socketWrapper is subscribed to any of the events in
   * this registry. This is useful to bind events on close only once
   *
   * @param {SocketWrapper} socketWrapper
   *
   * @public
   * @returns {Boolean} isLocalSubscriber
   */
  isLocalSubscriber(socketWrapper) {
    for (const name in this._subscriptions) {
      if (this._subscriptions[name].indexOf(socketWrapper) !== -1) {
        return true
      }
    }

    return false
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
  getLocalSubscribers(name) {
    return this._subscriptions[name] || []
  }

  /**
   * Returns a random SocketWrapper out of the array
   * of SocketWrappers that are subscribed to <name>
   *
   * @param   {String} name
   *
   * @public
   * @returns {SocketWrapper}
   */
  getRandomLocalSubscriber(name) {
    const subscribers = this.getLocalSubscribers(name)

    if (subscribers.length > 0) {
      return subscribers[Math.floor(Math.random() * subscribers.length)]
    }
    return null
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
  hasLocalSubscribers(name) {
    const subscriptions = this._subscriptions[name]
    return !!subscriptions && subscriptions.length !== 0
  }

  /**
   * Allows to set a subscriptionListener after the class had been instantiated
   *
   * @param {SubscriptionListener} subscriptionListener - a class exposing a onSubscriptionMade and onSubscriptionRemoved method
   *
   * @public
   * @returns {void}
   */
  setSubscriptionListener(subscriptionListener) {
    this._subscriptionListener = subscriptionListener
  }

  /**
   * Called when a subscription has been added to the cluster
   * This can be invoked locally or remotely, so we check if it
   * is a local invocation and ignore it if so in favour of the
   * call done from subscribe
   * @param  {String} name the name that was added
   */
  _onClusterSubscriptionAdded(name) {
    if (this._subscriptionListener && !this._subscriptions[name]) {
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
  _onClusterSubscriptionRemoved(name) {
    if (this._subscriptionListener && !this._subscriptions[name]) {
      this._subscriptionListener.onSubscriptionRemoved(name, null, 0, 0)
    }
  }

}

module.exports = SubscriptionRegistry
