'use strict'
/* eslint-disable valid-typeof */
const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const ListenerRegistry = require('../listen/listener-registry')

module.exports = class EventHandler {
  /**
   * Handles incoming and outgoing messages for the EVENT topic.
   *
   * @param {Object} options deepstream options
   *
   * @constructor
   */
  constructor (options, subscriptionRegistry, listenerRegistry, metaData) {
    this._metaData = metaData
    this._options = options
    this._subscriptionRegistry =
      subscriptionRegistry || new SubscriptionRegistry(options, C.TOPIC.EVENT)
    this._listenerRegistry =
      listenerRegistry || new ListenerRegistry(C.TOPIC.EVENT, options, this._subscriptionRegistry)
    this._subscriptionRegistry.setSubscriptionListener(this._listenerRegistry)
    this._logger = options.logger
  }

  /**
   * The main distribution method. Routes messages to functions
   * based on the provided action parameter of the message
   *
   * @param {SocketWrapper} socket
   * @param {Object} message parsed and permissioned deepstream message
   *
   * @public
   * @returns {void}
   */
  handle (socket, message) {
    if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._addSubscriber(socket, message)
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._removeSubscriber(socket, message)
    } else if (message.action === C.ACTIONS.EVENT) {
      this._triggerEvent(socket, message)
    } else if (message.action === C.ACTIONS.LISTEN ||
      message.action === C.ACTIONS.UNLISTEN ||
      message.action === C.ACTIONS.LISTEN_ACCEPT ||
      message.action === C.ACTIONS.LISTEN_REJECT) {
      this._listenerRegistry.handle(socket, message)
    } else {
      this._sendError(socket, C.EVENT.UNKNOWN_ACTION, `unknown action ${message.action}`)
    }
  }

  /**
   * Handler for the SUBSCRIBE action. Adds the socket as
   * a subscriber to the specified event name
   *
   * @param {SocketWrapper} socket
   * @param {Object} message parsed and permissioned deepstream message
   *
   * @private
   * @returns {void}
   */
  _addSubscriber (socket, message) {
    if (validateSubscriptionMessage(socket, message)) {
      this._subscriptionRegistry.subscribe(message.data[0], socket)
    }
  }

  /**
   * Handler for the UNSUBSCRIBE action. Removes the socket as
   * a subscriber from the specified event name
   *
   * @param {SocketWrapper} socket
   * @param {Object} message parsed and permissioned deepstream message
   *
   * @private
   * @returns {void}
   */
  _removeSubscriber (socket, message) {
    if (validateSubscriptionMessage(socket, message)) {
      this._subscriptionRegistry.unsubscribe(message.data[0], socket)
    }
  }

  /**
   * Notifies subscribers of events. This method is invoked for the EVENT action. It can
   * be triggered by messages coming in from both clients and the message connector.
   *
   * @param {String|SocketWrapper} socket If socket is the constant SOURCE_MESSAGE_CONNECTOR
   *                        the message was received from the message connector
   *
   * @param {Object} message parsed and permissioned deepstream message
   *
   * @private
   * @returns {void}
   */
  _triggerEvent (socket, message) {
    if (typeof message.data[0] !== 'string') {
      this._sendError(socket, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
      return
    }

    this._logger.debug(C.EVENT.TRIGGER_EVENT, message.raw, this._metaData)

    const eventMessage = { topic: C.TOPIC.EVENT, action: C.ACTIONS.EVENT, data: message.data }
    this._subscriptionRegistry.sendToSubscribers(message.data[0], eventMessage, false, socket)
  }

  _sendError (socket, event, message) {
    if (socket && socket.sendError) {
      socket.sendError(C.TOPIC.EVENT, event, message)
    }
    this._logger.error(event, message, this._metaData)
  }
}

/**
 * Makes sure that subscription message contains the name of the event. Sends an error to the client
 * if not
 *
 * @param {SocketWrapper} socket
 * @param {Object} message parsed and permissioned deepstream message
 *
 * @private
 * @returns {Boolean} is valid subscription message
 */
function validateSubscriptionMessage (socket, message) {
  if (message.data && message.data.length === 1 && typeof message.data[0] === 'string') {
    return true
  }

  socket.sendError(C.TOPIC.EVENT, C.EVENT.INVALID_MESSAGE_DATA, message.raw)

  return false
}
