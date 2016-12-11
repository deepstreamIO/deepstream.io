'use strict'

let C = require('../constants/constants'),
  messageParser = require('../message/message-parser'),
  messageBuilder = require('../message/message-builder'),
  utils = require('../utils/utils')

module.exports = class ListenerUtils {

	/**
	 * Construct a class with utils that can be called in from the main
	 * listener registery, but that do not actually require state.
	 * @param  {Topic} topic          the topic used to create the listen registery
	 * @param  {Object} options        the options the server was initialised with
	 * @param  {SubscriptionRegistery} clientRegistry the client registry passed into the listen registry
	 */
  constructor(topic, options, clientRegistry) {
    this._uniqueLockName = `${topic}_LISTEN_LOCK`
    this._topic = topic
    this._options = options
    this._clientRegistry = clientRegistry
  }

	/**
	 * Remove provider from listen in progress map if it unlistens during
	 * discovery stage
	 *
	 * @param  {Object} listensCurrentlyInProgress the listeners currently in progress
	 * @param  {String} pattern the pattern that has been unlistened to
	 * @param  {SocketWrapper} socketWrapper the socket wrapper of the provider that unlistened
	 */
  removeListenerFromInProgress(listensCurrentlyInProgress, pattern, socketWrapper) {
    let subscriptionName,
      i,
      listenInProgress
    for (subscriptionName in listensCurrentlyInProgress) {
      listenInProgress = listensCurrentlyInProgress[subscriptionName]
      for (i = 0; i < listenInProgress.length; i++) {
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
	 * @param  {SocketWrapper}  socketWrapper    the socket wrapper to send to, if it doesn't exist then don't do anything
	 * @param  {String}  subscriptionName The subscription name which provided status changed
	 */
  sendHasProviderUpdateToSingleSubscriber(hasProvider, socketWrapper, subscriptionName) {
    if (socketWrapper && this._topic === C.TOPIC.RECORD) {
      socketWrapper.send(this._createHasProviderMessage(hasProvider, this._topic, subscriptionName))
    }
  }

	/**
	 * Sends a has provider update to all subcribers
	 * @param  {Boolean} hasProvider      send T or F so provided status
	 * @param  {String}  subscriptionName The subscription name which provided status changed
	 */
  sendHasProviderUpdate(hasProvider, subscriptionName) {
    if (this._topic !== C.TOPIC.RECORD) {
      return
    }
    this._clientRegistry.sendToSubscribers(subscriptionName, this._createHasProviderMessage(hasProvider, this._topic, subscriptionName))
  }

	/**
	 * Sent by the listen leader, and is used to inform the next server in the cluster to
	 * start a local discovery
	 *
	 * @param  {String} serverName       the name of the server to notify
	 * @param  {String} subscriptionName the subscription to find a provider for
	 */
  sendRemoteDiscoveryStart(serverName, subscriptionName) {
    const messageTopic = this.getMessageBusTopic(serverName, this._topic)
    this._options.messageConnector.publish(messageTopic, {
      topic: messageTopic,
      action: C.ACTIONS.LISTEN,
      data: [serverName, subscriptionName, this._options.serverName]
    })
  }

	/**
	 * Sent by the listen follower, and is used to inform the leader that it has
	 * complete its local discovery start
	 *
	 * @param  {String} listenLeaderServerName	the name of the listen leader
	 * @param  {String} subscriptionName the subscription to that has just finished
	 */
  sendRemoteDiscoveryStop(listenLeaderServerName, subscriptionName) {
    const messageTopic = this.getMessageBusTopic(listenLeaderServerName, this._topic)
    this._options.messageConnector.publish(messageTopic, {
      topic: messageTopic,
      action: C.ACTIONS.ACK,
      data: [listenLeaderServerName, subscriptionName]
    })
  }

	/**
	* Send by a node when all local subscriptions are discarded, allowing other nodes
	* to do a provider cleanup if necessary
	*/
  sendLastSubscriberRemoved(serverName, subscriptionName) {
    const messageTopic = this.getMessageBusTopic(serverName, this._topic)
    this._options.messageConnector.publish(messageTopic, {
      topic: messageTopic,
      action: C.ACTIONS.UNSUBSCRIBE,
      data: [serverName, subscriptionName]
    })
  }

	/**
	 * Send a subscription found to a provider
	 *
	 * @param  {{patten:String, socketWrapper:SocketWrapper}} provider An object containing an provider that can provide the subscription
	 * @param  {String} subscriptionName the subscription to find a provider for
	 */
  sendSubscriptionForPatternFound(provider, subscriptionName) {
    provider.socketWrapper.send(messageBuilder.getMsg(
			this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_FOUND, [provider.pattern, subscriptionName]
			)
		)
  }

	/**
	 * Send a subscription removed to a provider
	 *
	 * @param  {{patten:String, socketWrapper:SocketWrapper}} provider An object containing the provider that is currently the active provider
	 * @param  {String} subscriptionName the subscription to stop providing
	 */
  sendSubscriptionForPatternRemoved(provider, subscriptionName) {
    provider.socketWrapper.send(
			messageBuilder.getMsg(
				this._topic, C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED, [provider.pattern, subscriptionName]
			)
		)
  }

	/**
	 * Create a map of all the listeners that patterns match the subscriptionName locally
	 * @param  {Object} patterns         All patterns currently on this deepstream node
	 * @param  {SusbcriptionRegistery} providerRegistry All the providers currently registered
	 * @param  {String} subscriptionName the subscription to find a provider for
	 * @return {Array}                  An array of all the providers that can provide the subscription
	 */
  createRemoteListenArray(patterns, providerRegistry, subscriptionName) {
    let pattern,
      providersForPattern,
      i
    let servers = []
    const providerPatterns = providerRegistry.getNames()

    for (i = 0; i < providerPatterns.length; i++) {
      pattern = providerPatterns[i]
      const p = patterns[pattern]
      if (p == null) {
        this._options.logger.log(C.LOG_LEVEL.WARN, '', `canot handle pattern${pattern}`)
        return
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
	 * @param  {SusbcriptionRegistery} providerRegistry All the providers currently registered
	 * @param  {String} subscriptionName the subscription to find a provider for
	 * @return {Array}                  An array of all the providers that can provide the subscription
	 */
  createLocalListenArray(patterns, providerRegistry, subscriptionName) {
    let pattern,
      providersForPattern,
      i
    const providers = []
    for (pattern in patterns) {
      if (patterns[pattern].test(subscriptionName)) {
        providersForPattern = providerRegistry.getLocalSubscribers(pattern)
        for (i = 0; providersForPattern && i < providersForPattern.length; i++) {
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
  getPattern(socketWrapper, message) {
    if (message.data.length > 2) {
      this.onMsgDataError(socketWrapper, message.raw)
      return null
    }

    const pattern = message.data[0]

    if (typeof pattern !== 'string') {
      this.onMsgDataError(socketWrapper, pattern)
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
  validatePattern(socketWrapper, pattern) {
    if (!pattern) {
      return false
    }

    try {
      return new RegExp(pattern)
    } catch (e) {
      this.onMsgDataError(socketWrapper, e.toString())
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
  onMsgDataError(socketWrapper, errorMsg, errorEvent) {
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
  getMessageBusTopic(serverName, topic) {
    return C.TOPIC.LEADER_PRIVATE + serverName + topic + C.ACTIONS.LISTEN
  }

	/**
	 * Returns the unique lock when leading a listen discovery phase
	 *
	 * @param  {String} subscriptionName the subscription to find a provider for
	 *
	 * @return {String}
	 */
  getUniqueLockName(subscriptionName) {
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
