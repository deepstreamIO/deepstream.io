'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const DistributedStateRegistry = require('../cluster/distributed-state-registry')

const DEPRECATED_EVERYONE = `U`

/**
 * This class handles incoming and outgoing messages in relation
 * to deepstream presence. It provides a way to inform clients
 * who else is logged into deepstream
 *
 * @param {Object} options    deepstream options
 * @param {Connection} connection
 * @param {Client} client
 * @public
 * @constructor
 */
module.exports = class PresenceHandler {

  constructor (options) {
    this._options = options
    this._localClients = new Map()

    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.PRESENCE)

    this._connectedClients = new DistributedStateRegistry(C.TOPIC.ONLINE_USERS, options)
    this._connectedClients.on('add', this._onClientAdded.bind(this))
    this._connectedClients.on('remove', this._onClientRemoved.bind(this))
  }

  /**
  * The main entry point to the presence handler class.
  *
  * Handles subscriptions, unsubscriptions and queries
  *
  * @param   {SocketWrapper} socketWrapper the socket that send the request
  * @param   {Object} message parsed and validated message
  *
  * @public
  * @returns {void}
  */
  handle (socketWrapper, message) {
    const users = this._parseUserNames(message.data && message.data[0], socketWrapper)
    if (message.action === C.ACTIONS.SUBSCRIBE) {
      for (let i = 0; i < users.length; i++) {
        this._subscriptionRegistry.subscribe(users[i], socketWrapper)
      }
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      for (let i = 0; i < users.length; i++) {
        this._subscriptionRegistry.unsubscribe(users[i], socketWrapper)
      }  
    } else if (message.action === C.ACTIONS.QUERY) {
      this._handleQuery(users, socketWrapper)
    } else {
      this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action)

      if (socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR) {
        socketWrapper.sendError(C.TOPIC.EVENT, C.EVENT.UNKNOWN_ACTION, `unknown action ${message.action}`)
      }
    }
  }

  /**
  * Called whenever a client has succesfully logged in with a username
  *
  * @param   {Object} socketWrapper the socketWrapper of the client that logged in
  *
  * @private
  * @returns {void}
  */
  handleJoin (socketWrapper) {
    let currentCount = this._localClients.get(socketWrapper.user)
    if (currentCount === undefined) {
      this._localClients.set(socketWrapper.user, 1)
      this._connectedClients.add(socketWrapper.user)
    } else {
      this._localClients.set(socketWrapper.user, ++currentCount)
    }
  }

  /**
  * Called whenever a client has disconnected
  *
  * @param   {Object} socketWrapper the socketWrapper of the client that disconnected
  *
  * @private
  * @returns {void}
  */
  handleLeave (socketWrapper) {
    let currentCount = this._localClients.get(socketWrapper.user)
    if (currentCount === 1) {
      this._localClients.delete(socketWrapper.user)
      this._connectedClients.remove(socketWrapper.user)
    } else {
      this._localClients.set(socketWrapper.user, --currentCount)
    }
  }

  /**
  * Handles finding clients who are connected and splicing out the client
  * querying for users
  *
  * @param   {Object} socketWrapper the socketWrapper of the client that is querying
  *
  * @private
  * @returns {void}
  */
  _handleQuery (users, socketWrapper) {
    if (users[0] === DEPRECATED_EVERYONE) {
      // LOG DEPRECATED MESSAGE
      const clients = this._connectedClients.getAll()
      const index = clients.indexOf(socketWrapper.user)
      if (index !== -1) {
        clients.splice(index, 1)
      }
      socketWrapper.sendMessage(C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients)
    } else {
      const result = {}
      const clients = this._connectedClients.getAllMap()
      for (let i = 0; i < users.length; i++) {
        result[users[i]] = clients[users[i]]
      }
      socketWrapper.sendMessage(C.TOPIC.PRESENCE, C.ACTIONS.QUERY, result)
    }
  }

  /**
  * Alerts all clients who are subscribed to
  * PRESENCE_JOIN that a new client has been added.
  *
  * @param   {String} username the username of the client that joined
  *
  * @private
  * @returns {void}
  */
  _onClientAdded (username) {
    const message = { topic: C.TOPIC.PRESENCE, action: C.ACTIONS.PRESENCE_JOIN, data: [username] }
    this._subscriptionRegistry.sendToSubscribers(DEPRECATED_EVERYONE, message)
    this._subscriptionRegistry.sendToSubscribers(username, message)
  }

  /**
  * Alerts all clients who are subscribed to
  * PRESENCE_LEAVE that the client has left.
  *
  * @param   {String} username the username of the client that left
  *
  * @private
  * @returns {void}
  */
  _onClientRemoved (username) {
    const message = { topic: C.TOPIC.PRESENCE, action: C.ACTIONS.PRESENCE_LEAVE, data: [username] }
    this._subscriptionRegistry.sendToSubscribers(DEPRECATED_EVERYONE, message)
    this._subscriptionRegistry.sendToSubscribers(username, message)
  }

  _parseUserNames (data, socketWrapper) {
    // Returns all users for backwards compatability
    if (
      !data || 
      data === C.ACTIONS.QUERY || 
      data === C.ACTIONS.SUBSCRIBE ||
      data === C.TOPIC.PRESENCE
    ) {
      return [ DEPRECATED_EVERYONE ]
    }
    try {
      return JSON.parse(data)
    } catch (e) {
      socketWrapper.sendError(
        C.TOPIC.EVENT, 
        C.EVENT.INVALID_PRESENCE_USERS, 
        `users are required to be a json array of usernames`
      )
      return null
    }
  }
}
