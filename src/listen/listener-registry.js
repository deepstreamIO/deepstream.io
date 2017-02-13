'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const DistributedStateRegistry = require('../cluster/distributed-state-registry')
const TimeoutRegistry = require('./listener-timeout-registry')
const messageBuilder = require('../message/message-builder')

module.exports = class ListenerRegistry {

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
  * notification logic is handled by this._providerRegistry
  *
  * @constructor
  *
  * @param {Object} options       DeepStream options
  * @param {SubscriptionRegistry} clientRegistry The SubscriptionRegistry containing the record
  *                                              subscriptions to allow new listeners to be
  *                                              notified of existing subscriptions
  */
  constructor(topic, options, clientRegistry) {
    this._topic = topic
    this._options = options
    this._clientRegistry = clientRegistry
    this._uniqueLockName = `${topic}_LISTEN_LOCK`

    this._uniqueStateProvider = this._options.uniqueRegistry
    this._messageConnector = this._options.messageConnector

    this._patterns = {}
    this._localListenInProgress = {}
    this._listenerTimeoutRegistry = new TimeoutRegistry(topic, options)

    this._locallyProvidedRecords = {}

    this._leadListen = {}
    this._leadingListen = {}

    this._setupProviderRegistry()
    this._setupRemoteComponents()
  }

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  _setupProviderRegistry() {
    this._providerRegistry = new SubscriptionRegistry(this._options, this._topic, `${this._topic}_${C.TOPIC.LISTEN_PATTERNS}`)
    this._providerRegistry.setAction('subscribe', C.ACTIONS.LISTEN)
    this._providerRegistry.setAction('unsubscribe', C.ACTIONS.UNLISTEN)
    this._providerRegistry.setSubscriptionListener({
      onSubscriptionRemoved: this._removePattern.bind(this),
      onSubscriptionMade: this._addPattern.bind(this)
    })
  }

  /**
   * Setup all the remote components and actions required to deal with the subscription
   * via the cluster.
   */
  _setupRemoteComponents() {
    this._clusterProvidedRecords = new DistributedStateRegistry(
      `${this._topic}_${C.TOPIC.PUBLISHED_SUBSCRIPTIONS}`,
      this._options
    )
    this._clusterProvidedRecords.on('add', this._onRecordStartProvided.bind(this))
    this._clusterProvidedRecords.on('remove', this._onRecordStopProvided.bind(this))

    this._messageConnector.subscribe(
      this._getMessageBusTopic(this._options.serverName, this._topic),
      this._onIncomingMessage.bind(this)
    )
  }

  /**
  * Used primarily for tests. Returns whether or not a provider exists for
  * the specific subscriptionName
  * @public
  * @returns {boolean}
  */
  hasActiveProvider(susbcriptionName) {
    return this._clusterProvidedRecords.has(susbcriptionName)
  }

  /**
  * The main entry point to the handle class.
  * Called on any of the following actions:
  *
  * 1) C.ACTIONS.LISTEN
  * 2) C.ACTIONS.UNLISTEN
  * 3) C.ACTIONS.LISTEN_ACCEPT
  * 4) C.ACTIONS.LISTEN_REJECT
  * 5) C.ACTIONS.LISTEN_SNAPSHOT
  *
  * @param   {SocketWrapper} socketWrapper the socket that send the request
  * @param   {Object} message parsed and validated message
  *
  * @public
  * @returns {void}
  */
  handle(socketWrapper, message) {
    const pattern = message.data[0]
    const subscriptionName = message.data[1]
    if (message.action === C.ACTIONS.LISTEN) {
      this._addListener(socketWrapper, message)
    } else if (message.action === C.ACTIONS.UNLISTEN) {
      this._providerRegistry.unsubscribe(pattern, socketWrapper)
      this._removeListener(socketWrapper, message)
    } else if (this._listenerTimeoutRegistry.isALateResponder(socketWrapper, message)) {
      this._listenerTimeoutRegistry.handle(socketWrapper, message)
    } else if (this._localListenInProgress[subscriptionName]) {
      this._processResponseForListenInProgress(socketWrapper, subscriptionName, message)
    } else {
      this._onMsgDataError(socketWrapper, message.raw, C.EVENT.INVALID_MESSAGE)
    }
  }

  /**
  * Handle messages that arrive via the message bus
  *
  * This can either be messages by the leader indicating that this
  * node is responsible for starting a local discovery phase
  * or from a resulting node with an ACK to allow the leader
  * to move on and release its lock
  *
  * @param  {Object} message The received message
  *
  * @private
  * @returns {void}
  */
  _onIncomingMessage(message) {
    if (this._options.serverName !== message.data[0]) {
      return
    }
    if (message.action === C.ACTIONS.LISTEN) {
      this._leadListen[message.data[1]] = message.data[2]
      this._startLocalDiscoveryStage(message.data[1])
    } else if (message.action === C.ACTIONS.ACK) {
      this._nextDiscoveryStage(message.data[1])
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this.onSubscriptionRemoved(
        message.data[1],
        null,
        this._clientRegistry.getLocalSubscribers(message.data[1]).length,
        this._clientRegistry.getAllServers(message.data[1]).length - 1
      )
    }
  }

  /**
  * Process an accept or reject for a listen that is currently in progress
  * and hasn't timed out yet.
  *
  * @param   {SocketWrapper} socketWrapper   The socket endpoint of the listener
  * @param   {String} subscriptionName       The name of the subscription that a listen
  *                                          is in process for
  * @param   {Object} message                Deepstream message object
  *
  * @private
  * @returns {void}
  */
  _processResponseForListenInProgress(socketWrapper, subscriptionName, message) {
    if (message.action === C.ACTIONS.LISTEN_ACCEPT) {
      this._accept(socketWrapper, message)
      this._listenerTimeoutRegistry.rejectLateResponderThatAccepted(subscriptionName)
      this._listenerTimeoutRegistry.clear(subscriptionName)
    } else if (message.action === C.ACTIONS.LISTEN_REJECT) {
      const provider = this._listenerTimeoutRegistry.getLateResponderThatAccepted(subscriptionName)
      if (provider) {
        this._accept(provider.socketWrapper, message)
        this._listenerTimeoutRegistry.clear(subscriptionName)
      } else {
        this._triggerNextProvider(subscriptionName)
      }
    }
  }

  /**
  * Called by the record subscription registry whenever the subscription count decrements.
  * Part of the subscriptionListener interface.
  *
  * @param   {String} name
  *
  * @public
  * @returns {void}
  */
  onSubscriptionMade(subscriptionName, socketWrapper, localCount) {
    if (this.hasActiveProvider(subscriptionName)) {
      this._sendHasProviderUpdateToSingleSubscriber(true, socketWrapper, subscriptionName)
      return
    }

    if (localCount > 1) {
      return
    }

    this._startDiscoveryStage(subscriptionName)
  }

  /**
  * Called by the record subscription registry whenever the subscription count increments.
  * Part of the subscriptionListener interface.
  *
  * @param   {String} subscriptionName
  *
  * @public
  * @returns {void}
  */
  onSubscriptionRemoved(subscriptionName, socketWrapper, localCount, remoteCount) {
    const provider = this._locallyProvidedRecords[subscriptionName]

    if (this.hasActiveProvider(subscriptionName) && !provider) {
      const serverName = this._clusterProvidedRecords.getAllServers(subscriptionName)[0]
      this._sendLastSubscriberRemoved(serverName, subscriptionName)
      return
    }

    if (!provider) {
      return
    }

    if (localCount > 1 || remoteCount > 0) {
      return
    }

    // provider discarded, but there is still another active subscriber
    if (localCount === 1 && provider.socketWrapper === socketWrapper) {
      return
    }

    // provider isn't a subscriber, meaning we should wait for 0
    const subscribers = this._clientRegistry.getLocalSubscribers(subscriptionName)
    if (localCount === 1 && subscribers.indexOf(provider.socketWrapper) === -1) {
      return
    }

    this._sendSubscriptionForPatternRemoved(provider, subscriptionName)
    this._removeActiveListener(subscriptionName)
  }

  /**
  * Register callback for when the server recieves an accept message from the client
  *
  * @private
  * @returns {void}
  */
  _accept(socketWrapper, message) {
    const subscriptionName = message.data[1]

    this._listenerTimeoutRegistry.clearTimeout(subscriptionName)

    this._locallyProvidedRecords[subscriptionName] = {
      socketWrapper,
      pattern: message.data[0],
      closeListener: this._removeListener.bind(this, socketWrapper, message)
    }
    socketWrapper.once('close', this._locallyProvidedRecords[subscriptionName].closeListener)
    this._clusterProvidedRecords.add(subscriptionName)

    this._stopLocalDiscoveryStage(subscriptionName)
  }

  /**
  * Register a client as a listener for record subscriptions
  *
  * @param   {SocketWrapper} socketWrapper the socket that send the request
  * @param   {Object} message parsed and validated message
  *
  * @private
  * @returns {void}
  */
  _addListener(socketWrapper, message) {
    const pattern = this._getPattern(socketWrapper, message)
    const regExp = this._validatePattern(socketWrapper, pattern)

    if (!regExp) {
      return
    }

    if (this._providerRegistry.getLocalSubscribers(pattern).indexOf(socketWrapper) === -1) {
      this._providerRegistry.subscribe(pattern, socketWrapper)
    }

    this._reconcileSubscriptionsToPatterns(regExp, pattern, socketWrapper)
  }

  /**
  * Find subscriptions that match pattern, and notify them that
  * they can be provided.
  *
  * We will attempt to notify all possible providers rather than
  * just the single provider for load balancing purposes and
  * so that the one listener doesnt potentially get overwhelmed.
  *
  * @private
  * @returns {Message}
  */
  _reconcileSubscriptionsToPatterns(regExp, pattern, socketWrapper) {
    for (const subscriptionName of this._clientRegistry.getNames()) {
      if (!subscriptionName.match(regExp)) {
        continue
      }

      if (this._locallyProvidedRecords[subscriptionName]) {
        continue
      }

      const listenInProgress = this._localListenInProgress[subscriptionName]

      if (listenInProgress) {
        listenInProgress.push({ socketWrapper, pattern })
      } else {
        this._startDiscoveryStage(subscriptionName)
      }
    }
  }

  /**
  * De-register a client as a listener for record subscriptions
  *
  * @param   {SocketWrapper} socketWrapper the socket that send the request
  * @param   {Object} message parsed and validated message
  *
  * @private
  * @returns {void}
  */
  _removeListener(socketWrapper, message) {
    const pattern = message.data[0]

    this._removeListenerFromInProgress(this._localListenInProgress, pattern, socketWrapper)
    this._removeListenerIfActive(pattern, socketWrapper)
  }

  /**
  * Removes the listener if it is the currently active publisher, and retriggers
  * another listener discovery phase
  *
  * @private
  * @returns {Message}
  */
  _removeListenerIfActive(pattern, socketWrapper) {
    for (const subscriptionName in this._locallyProvidedRecords) {
      const provider = this._locallyProvidedRecords[subscriptionName]
      if (
        provider.socketWrapper === socketWrapper &&
        provider.pattern === pattern
      ) {
        provider.socketWrapper.removeListener('close', provider.closeListener)
        this._removeActiveListener(subscriptionName)
        if (this._clientRegistry.hasLocalSubscribers(subscriptionName)) {
          this._startDiscoveryStage(subscriptionName)
        }
      }
    }
  }

  /**
  * @private
  * @returns {Void}
    */
  _removeActiveListener(subscriptionName) {
    delete this._locallyProvidedRecords[subscriptionName]
    this._clusterProvidedRecords.remove(subscriptionName)
  }

  /**
  * Start discovery phase once a lock is obtained from the leader within
  * the cluster
  *
  * @param   {String} subscriptionName the subscription name
  *
  * @private
  * @returns {void}
  */
  _startDiscoveryStage(subscriptionName) {
    const localListenArray = this._createLocalListenArray(
      this._patterns,
      this._providerRegistry,
      subscriptionName
    )

    if (localListenArray.length === 0) {
      return
    }

    this._uniqueStateProvider.get(this._getUniqueLockName(subscriptionName), (success) => {
      if (!success) {
        return
      }

      if (this.hasActiveProvider(subscriptionName)) {
        this._uniqueStateProvider.release(this._getUniqueLockName(subscriptionName))
        return
      }

      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        C.EVENT.LEADING_LISTEN,
        `started for ${this._topic}:${subscriptionName}`
      )

      const remoteListenArray = this._createRemoteListenArray(
        this._patterns,
        this._providerRegistry,
        subscriptionName
      )
      this._leadingListen[subscriptionName] = remoteListenArray

      this._startLocalDiscoveryStage(subscriptionName, localListenArray)
    })
  }

  /**
  * called when a subscription has been provided to clear down the discovery stage,
  * or when an ack has been recieved via the message bus
  *
  * @param  {String} subscriptionName check if the subscription has a provider yet,
  *                                   if not trigger the next request via the message
  *                                   bus
  *
  * @private
  * @returns {void}
  */
  _nextDiscoveryStage(subscriptionName) {
    if (
      this.hasActiveProvider(subscriptionName) ||
      this._leadingListen[subscriptionName].length === 0
    ) {
      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        C.EVENT.LEADING_LISTEN,
        `finished for ${this._topic}:${subscriptionName}`
      )
      delete this._leadingListen[subscriptionName]
      this._uniqueStateProvider.release(this._getUniqueLockName(subscriptionName))
    } else {
      const nextServerName = this._leadingListen[subscriptionName].shift()
      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        C.EVENT.LEADING_LISTEN,
        `started for ${this._topic}:${subscriptionName}`
      )
      this._sendRemoteDiscoveryStart(nextServerName, subscriptionName)
    }
  }

  /**
  * Start discovery phase once a lock is obtained from the leader within
  * the cluster
  *
  * @param   {String} subscriptionName the subscription name
  * @param   {Object} [localListenMap] map of all listeners
  *
  * @private
  * @returns {void}
  */
  _startLocalDiscoveryStage(subscriptionName, localListenArray) {
    if (!localListenArray) {
      localListenArray = this._createLocalListenArray(
        this._patterns,
        this._providerRegistry,
        subscriptionName
      )
    }

    if (localListenArray.length > 0) {
      this._options.logger.log(
        C.LOG_LEVEL.DEBUG,
        C.EVENT.LOCAL_LISTEN,
        `started for ${this._topic}:${subscriptionName}`
      )
      this._localListenInProgress[subscriptionName] = localListenArray
      this._triggerNextProvider(subscriptionName)
    }
  }

  /**
  * Finalises a local listener discovery stage
  *
  * @param   {String} subscriptionName the subscription a listener is searched for
  *
  * @private
  * @returns {void}
  */
  _stopLocalDiscoveryStage(subscriptionName) {
    delete this._localListenInProgress[subscriptionName]

    this._options.logger.log(
      C.LOG_LEVEL.DEBUG,
      C.EVENT.LOCAL_LISTEN,
      `stopped for ${this._topic}:${subscriptionName}`
    )

    if (this._leadingListen[subscriptionName]) {
      this._nextDiscoveryStage(subscriptionName)
    } else {
      this._sendRemoteDiscoveryStop(this._leadListen[subscriptionName], subscriptionName)
      delete this._leadListen[subscriptionName]
    }
  }

  /**
  * Trigger the next provider in the map of providers capable of publishing
  * data to the specific subscriptionName
  *
  * @param   {String} subscriptionName the subscription a listener is searched for
  *
  * @private
  * @returns {void}
  */
  _triggerNextProvider(subscriptionName) {
    const listenInProgress = this._localListenInProgress[subscriptionName]

    if (typeof listenInProgress === 'undefined') {
      return
    }

    if (listenInProgress.length === 0) {
      this._stopLocalDiscoveryStage(subscriptionName)
      return
    }

    const provider = listenInProgress.shift()
    const subscribers = this._clientRegistry.getLocalSubscribers(subscriptionName)

    if (subscribers && subscribers.indexOf(provider.socketWrapper) !== -1) {
      this._stopLocalDiscoveryStage(subscriptionName)
      return
    }

    this._listenerTimeoutRegistry.addTimeout(
      subscriptionName,
      provider,
      this._triggerNextProvider.bind(this)
    )

    this._sendSubscriptionForPatternFound(provider, subscriptionName)
  }

  /**
  * Triggered when a subscription is being provided by a node in the cluster
  *
  * @param   {String} subscriptionName the subscription a listener is searched for
  *
  * @private
  * @returns {void}
  */
  _onRecordStartProvided(subscriptionName) {
    this._sendHasProviderUpdate(true, subscriptionName)
    if (this._leadingListen[subscriptionName]) {
      this._nextDiscoveryStage(subscriptionName)
    }
  }

  /**
  * Triggered when a subscription is stopped being provided by a node in the cluster
  *
  * @param   {String} subscriptionName the subscription a listener is searched for
  *
  * @private
  * @returns {void}
  */
  _onRecordStopProvided(subscriptionName) {
    this._sendHasProviderUpdate(false, subscriptionName)
    if (
      !this.hasActiveProvider(subscriptionName) &&
      this._clientRegistry.hasName(subscriptionName)
    ) {
      this._startDiscoveryStage(subscriptionName)
    }
  }

  /**
  * Compiles a regular expression from an incoming pattern
  *
  * @param {String} pattern       the raw pattern
  * @param {SocketWrapper} socketWrapper connection to the client that provided the pattern
  * @param {Number} count         the amount of times this pattern is present
  *
  * @private
  * @returns {void}
  */
  _addPattern(pattern, socketWrapper, count) {
    if (count === 1) {
      this._patterns[pattern] = new RegExp(pattern)
    }
  }

  /**
  * Deletes the pattern regex when removed
  *
  * @param {String} pattern       the raw pattern
  * @param {SocketWrapper} socketWrapper connection to the client that provided the pattern
  * @param {Number} count         the amount of times this pattern is present
  *
  * @private
  * @returns {void}
  */
  _removePattern(pattern, socketWrapper, count) {
    if (socketWrapper) {
      this._listenerTimeoutRegistry.removeProvider(socketWrapper)
      this._removeListenerFromInProgress(this._localListenInProgress, pattern, socketWrapper)
      this._removeListenerIfActive(pattern, socketWrapper)
    }

    if (count === 0) {
      delete this._patterns[pattern]
    }
  }

  /**
  * Remove provider from listen in progress map if it unlistens during
  * discovery stage
  *
  * @param  {Object} listensCurrentlyInProgress the listeners currently in progress
  * @param  {String} pattern the pattern that has been unlistened to
  * @param  {SocketWrapper} socketWrapper the socket wrapper of the provider that unlistened
  */
  _removeListenerFromInProgress(listensCurrentlyInProgress, pattern, socketWrapper) {
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
  * @param  {Boolean} hasProvider      send T or F so provided status
  * @param  {SocketWrapper}  socketWrapper    the socket wrapper to send to,
  *                                           if it doesn't exist then don't do anything
  * @param  {String}  subscriptionName The subscription name which provided status changed
  */
  _sendHasProviderUpdateToSingleSubscriber(hasProvider, socketWrapper, subscriptionName) {
    if (socketWrapper && this._topic === C.TOPIC.RECORD) {
      socketWrapper.send(this._createHasProviderMessage(hasProvider, this._topic, subscriptionName))
    }
  }

  /**
  * Sends a has provider update to all subcribers
  * @param  {Boolean} hasProvider      send T or F so provided status
  * @param  {String}  subscriptionName The subscription name which provided status changed
  */
  _sendHasProviderUpdate(hasProvider, subscriptionName) {
    if (this._topic !== C.TOPIC.RECORD) {
      return
    }
    this._clientRegistry.sendToSubscribers(
      subscriptionName,
      this._createHasProviderMessage(hasProvider, this._topic, subscriptionName)
    )
  }

  /**
  * Sent by the listen leader, and is used to inform the next server in the cluster to
  * start a local discovery
  *
  * @param  {String} serverName       the name of the server to notify
  * @param  {String} subscriptionName the subscription to find a provider for
  */
  _sendRemoteDiscoveryStart(serverName, subscriptionName) {
    const messageTopic = this._getMessageBusTopic(serverName, this._topic)
    this._messageConnector.publish(messageTopic, {
      topic: messageTopic,
      action: C.ACTIONS.LISTEN,
      data: [serverName, subscriptionName, this._options.serverName]
    })
  }

  /**
  * Sent by the listen follower, and is used to inform the leader that it has
  * complete its local discovery start
  *
  * @param  {String} listenLeaderServerName  the name of the listen leader
  * @param  {String} subscriptionName the subscription to that has just finished
  */
  _sendRemoteDiscoveryStop(listenLeaderServerName, subscriptionName) {
    const messageTopic = this._getMessageBusTopic(listenLeaderServerName, this._topic)
    this._messageConnector.publish(messageTopic, {
      topic: messageTopic,
      action: C.ACTIONS.ACK,
      data: [listenLeaderServerName, subscriptionName]
    })
  }

  /**
    * Send by a node when all local subscriptions are discarded, allowing other nodes
    * to do a provider cleanup if necessary
    */
  _sendLastSubscriberRemoved(serverName, subscriptionName) {
    const messageTopic = this._getMessageBusTopic(serverName, this._topic)
    this._messageConnector.publish(messageTopic, {
      topic: messageTopic,
      action: C.ACTIONS.UNSUBSCRIBE,
      data: [serverName, subscriptionName]
    })
  }

  /**
  * Send a subscription found to a provider
  *
  * @param  {{patten:String, socketWrapper:SocketWrapper}} provider A client that can
  *                                                        provide the subscription
  * @param  {String} subscriptionName the subscription to find a provider for
  */
  _sendSubscriptionForPatternFound(provider, subscriptionName) {
    provider.socketWrapper.send(
      messageBuilder.getMsg(
        this._topic,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND,
        [provider.pattern, subscriptionName]
      )
    )
  }

  /**
  * Send a subscription removed to a provider
  *
  * @param  {{patten:String, socketWrapper:SocketWrapper}} provider An object containing the
  *                                                        client that is currently the active
  *                                                        provider
  * @param  {String} subscriptionName the subscription to stop providing
  */
  _sendSubscriptionForPatternRemoved(provider, subscriptionName) {
    provider.socketWrapper.send(
      messageBuilder.getMsg(
        this._topic,
        C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        [provider.pattern, subscriptionName]
      )
    )
  }

  /**
  * Create a map of all the listeners that patterns match the subscriptionName locally
  * @param  {Object} patterns         All patterns currently on this deepstream node
  * @param  {SusbcriptionRegistry} providerRegistry All the providers currently registered
  * @param  {String} subscriptionName the subscription to find a provider for
  * @return {Array}                  An array of all the providers that can provide the subscription
  */
  _createRemoteListenArray(patterns, providerRegistry, subscriptionName) {
    let servers = []
    const providerPatterns = providerRegistry.getNames()

    for (let i = 0; i < providerPatterns.length; i++) {
      const pattern = providerPatterns[i]
      const p = patterns[pattern]
      if (p == null) {
        this._options.logger.log(C.LOG_LEVEL.WARN, '', `can't handle pattern ${pattern}`)
        return null
      }
      if (p.test(subscriptionName)) {
        servers = servers.concat(providerRegistry.getAllServers(pattern))
      }
    }

    const set = new Set(servers)
    set.delete(this._options.serverName)
    return Array.from(set)
  }

  /**
  * Create a map of all the listeners that patterns match the subscriptionName locally
  * @param  {Object} patterns         All patterns currently on this deepstream node
  * @param  {SusbcriptionRegistry} providerRegistry All the providers currently registered
  * @param  {String} subscriptionName the subscription to find a provider for
  * @return {Array}                  An array of all the providers that can provide the subscription
  */
  _createLocalListenArray(patterns, providerRegistry, subscriptionName) {
    const providers = []
    for (const pattern in patterns) {
      if (patterns[pattern].test(subscriptionName)) {
        const providersForPattern = providerRegistry.getLocalSubscribers(pattern)
        for (let i = 0; i < providersForPattern.length; i++) {
          providers.push({
            pattern,
            socketWrapper: providersForPattern[i]
          })
        }
      }
    }
    return providers
  }

  /**
  * Extracts the subscription pattern from the message and notifies the sender
  * if something went wrong
  *
  * @param   {SocketWrapper} socketWrapper
  * @param   {Object} message
  *
  * @returns {String}
  */
  _getPattern(socketWrapper, message) {
    if (message.data.length > 2) {
      this._onMsgDataError(socketWrapper, message.raw)
      return null
    }

    const pattern = message.data[0]

    if (typeof pattern !== 'string') {
      this._onMsgDataError(socketWrapper, pattern)
      return null
    }

    return pattern
  }

  /**
  * Validates that the pattern is not empty and is a valid regular expression
  *
  * @param   {SocketWrapper} socketWrapper
  * @param   {String} pattern
  *
  * @returns {RegExp}
  */
  _validatePattern(socketWrapper, pattern) {
    if (!pattern) {
      return false
    }

    try {
      return new RegExp(pattern)
    } catch (e) {
      this._onMsgDataError(socketWrapper, e.toString())
      return false
    }
  }

  /**
  * Processes errors for invalid messages
  *
  * @param   {SocketWrapper} socketWrapper
  * @param   {String} errorMsg
  * @param   {Event} [errorEvent] Default to C.EVENT.INVALID_MESSAGE_DATA
  */
  _onMsgDataError(socketWrapper, errorMsg, errorEvent) {
    errorEvent = errorEvent || C.EVENT.INVALID_MESSAGE_DATA
    socketWrapper.sendError(this._topic, errorEvent, errorMsg)
    // TODO: This isn't a CRITICAL error, would we say its an info
    this._options.logger.log(C.LOG_LEVEL.ERROR, errorEvent, errorMsg)
  }

  /**
  * Get the unique topic to use for the message bus
  * @param  {String} serverName the name of the server
  * @param  {Topic} topic
  * @return {String}
  */
  _getMessageBusTopic(serverName, topic) {
    return C.TOPIC.LEADER_PRIVATE + serverName + topic + C.ACTIONS.LISTEN
  }

  /**
  * Returns the unique lock when leading a listen discovery phase
  *
  * @param  {String} subscriptionName the subscription to find a provider for
  *
  * @return {String}
  */
  _getUniqueLockName(subscriptionName) {
    return `${this._uniqueLockName}_${subscriptionName}`
  }

  /**
  * Create a has provider update message
  *
  * @returns {Message}
  */
  _createHasProviderMessage(hasProvider, topic, subscriptionName) {
    return messageBuilder.getMsg(
      topic,
      C.ACTIONS.SUBSCRIPTION_HAS_PROVIDER,
      [subscriptionName, (hasProvider ? C.TYPES.TRUE : C.TYPES.FALSE)]
    )
  }
}
