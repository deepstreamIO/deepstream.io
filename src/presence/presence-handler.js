'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const DistributedStateRegistry = require('../cluster/distributed-state-registry')
const messageBuilder = require('../message/message-builder')

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

  constructor(options) {
    this._options = options
    this._localClients = new Map()
    this._connectionEndpoint = options.connectionEndpoint
    this._connectionEndpoint.on('client-connected', this._handleJoin.bind(this))
    this._connectionEndpoint.on('client-disconnected', this._handleLeave.bind(this))

    this._presenceRegistry = new SubscriptionRegistry(options, C.TOPIC.PRESENCE)

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
  handle(socketWrapper, message) {
    if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._presenceRegistry.subscribe(C.TOPIC.PRESENCE, socketWrapper)
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._presenceRegistry.unsubscribe(C.TOPIC.PRESENCE, socketWrapper)
    } else if (message.action === C.ACTIONS.QUERY) {
      this._handleQuery(socketWrapper)
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
  _handleJoin(socketWrapper) {
    let currentCount = this._localClients.get(socketWrapper.user)
    if (currentCount === undefined) {
      this._localClients.set(socketWrapper.user, 1)
      this._connectedClients.add(socketWrapper.user)
    } else {
      currentCount++
      this._localClients.set(socketWrapper.user, currentCount)
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
  _handleLeave(socketWrapper) {
    let currentCount = this._localClients.get(socketWrapper.user)
    if (currentCount === 1) {
      this._localClients.delete(socketWrapper.user)
      this._connectedClients.remove(socketWrapper.user)
    } else {
      currentCount--
      this._localClients.set(socketWrapper.user, currentCount)
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
  _handleQuery(socketWrapper) {
    const clients = this._connectedClients.getAll()
    const index = clients.indexOf(socketWrapper.user)
    if (index !== -1) {
      clients.splice(index, 1)
    }
    socketWrapper.sendMessage(C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients)
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
  _onClientAdded(username) {
    const addMsg = messageBuilder.getMsg(C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_JOIN, [username])
    this._presenceRegistry.sendToSubscribers(C.TOPIC.PRESENCE, addMsg)
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
  _onClientRemoved(username) {
    const removeMsg = messageBuilder.getMsg(C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_LEAVE, [username])
    this._presenceRegistry.sendToSubscribers(C.TOPIC.PRESENCE, removeMsg)
  }
}
