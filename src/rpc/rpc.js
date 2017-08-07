'use strict'
/* eslint-disable max-len */

const C = require('../constants/constants')
const RpcProxy = require('./rpc-proxy')

/**
 * Relays a remote procedure call from a requestor to a provider and routes
 * the providers response to the requestor. Provider might either be a locally
 * connected SocketWrapper or a RpcProviderProxy that forwards messages
 * from a remote provider within the network
 */
module.exports = class Rpc {
  /**
  * @param {RpcHandler}           rpcHandler
  * @param {String|SocketWrapper} requestor SocketWrapper if requested locally,
  *                                         C.SOURCE_MESSAGE_CONNECTOR if requested
  *                                         by the message connector
  * @param {SocketWrapper|RpcProviderProxy} provider  A SocketWrapper like class, able to provide the rpc
  * @param {Object} options
  * @param {Object} message
  *
  * @constructor
  */
  constructor (rpcHandler, requestor, provider, options, message) {
    this._rpcHandler = rpcHandler
    this._rpcName = message.data[0]
    this._correlationId = message.data[1]
    this._requestor = requestor
    this._provider = provider
    this._options = options
    this._message = message
    this._isAcknowledged = false

    this._setProvider(provider)
  }

  /**
  * Processor for incoming messages from the RPC provider. The
  * RPC provider is expected to send two messages,
  *
  * RPC|A|REQ|<rpcName>|<correlationId>
  *
  * and
  *
  * RPC|RES|<rpcName>|<correlationId|[<data>]
  *
  * Both of these messages will just be forwarded directly
  * to the requestor
  *
  * @param   {Object} message parsed and validated provider message
  *
  * @private
  * @returns {void}
  */
  handle (message) {
    if (message.data[1] !== this._correlationId && message.data[2] !== this._correlationId) {
      return
    }

    if (message.action === C.ACTIONS.ACK) {
      this._handleAck(message)
    } else if (message.action === C.ACTIONS.REJECTION) {
      this._reroute()
    } else if (message.action === C.ACTIONS.RESPONSE || message.action === C.ACTIONS.ERROR) {
      this._handleResponse(message)
    }
  }

  /**
  * Destroyes this Rpc, either because its completed
  * or because a timeout has occured
  *
  * @public
  * @returns {void}
  */
  destroy () {
    clearTimeout(this._ackTimeout)
    clearTimeout(this._responseTimeout)

    this._rpcHandler._$onDestroy(this._correlationId)
  }

  /**
  * By default, a RPC is the communication between one requestor
  * and one provider. If the original provider however rejects
  * the request, deepstream will try to re-route it to another provider.
  *
  * This happens in the reroute method. This method will query
  * the rpc-handler for an alternative provider and - if it has
  * found one - call this method to replace the provider and re-do
  * the second leg of the rpc
  *
  * @param {SocketWrapper} provider
  *
  * @private
  * @returns {void}
  */
  _setProvider (provider) {
    clearTimeout(this._ackTimeout)
    clearTimeout(this._responseTimeout)

    this._provider = provider
    this._ackTimeout = setTimeout(this._onAckTimeout.bind(this), this._options.rpcAckTimeout)
    this._responseTimeout = setTimeout(this._onResponseTimeout.bind(this), this._options.rpcTimeout)
    this._send(this._provider, this._message, this._requestor)
  }

  /**
  * Handles rpc acknowledgement messages from the provider.
  * If more than one Ack is received an error will be returned
  * to the provider
  *
  * @param   {Object} message parsed and validated deepstream message
  *
  * @private
  * @returns {void}
  */
  _handleAck (message) {
    if (this._isAcknowledged === true) {
      this._provider.sendError(C.TOPIC.RPC, C.EVENT.MULTIPLE_ACK, [this._rpcName, this._correlationId])
      return
    }

    clearTimeout(this._ackTimeout)
    this._isAcknowledged = true
    this._send(this._requestor, message, this._provider)
  }

  /**
  * Forwards response messages from the provider. If the provider
  * sends more than one response subsequent messages will just
  * be ignored
  *
  * @param   {Object} message parsed and validated deepstream message
  *
  * @private
  * @returns {void}
  */
  _handleResponse (message) {
    this._send(this._requestor, message, this._provider)
    this.destroy()
  }

  /**
  * This method handles rejection messages from the current provider. If
  * a provider is temporarily unable to serve a request, it can reject it
  * and deepstream will try to reroute to an alternative provider
  *
  * If no alternative provider could be found, this method will send a NO_RPC_PROVIDER
  * error to the client and destroy itself
  *
  * @private
  * @returns {void}
  */
  _reroute () {
    const alternativeProvider = this._rpcHandler.getAlternativeProvider(this._rpcName, this._correlationId)

    if (alternativeProvider) {
      this._setProvider(alternativeProvider)
    } else {
      this._requestor.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [this._rpcName, this._correlationId])
      this.destroy()
    }
  }

  /**
  * Callback if the acknowledge message hasn't been returned
  * in time by the provider
  *
  * @private
  * @returns {void}
  */
  _onAckTimeout () {
    this._requestor.sendError(C.TOPIC.RPC, C.EVENT.ACK_TIMEOUT, [this._rpcName, this._correlationId])
    this.destroy()
  }

  /**
  * Callback if the response message hasn't been returned
  * in time by the provider
  *
  * @private
  * @returns {void}
  */
  _onResponseTimeout () {
    this._requestor.sendError(C.TOPIC.RPC, C.EVENT.RESPONSE_TIMEOUT, [this._rpcName, this._correlationId])
    this.destroy()
  }

  /**
  * Sends a message to a receiver.
  *
  * @param   {SocketWrapper} receiver    the SocketWrapper that will receive the message. Can be a RpcProxy
  * @param   {Object}        message     deepstream message object
  *
  * @private
  * @returns {void}
  */
  _send (receiver, message) { // eslint-disable-line
    if (receiver instanceof RpcProxy) {
      receiver.send(message)
      return
    }

    receiver.sendMessage(message.topic, message.action, message.data)
  }
}
