'use strict'

const C = require('../constants/constants')

/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky.
 */
module.exports = class RpcProxy {

  /**
  * @param {Object} options
  * @param {String} receiverPrivateTopic
  * @return {[type]}
  * @constructor
  */
  constructor (options, remoteServer, metaData) {
    this._metaData = metaData
    this._options = options
    this._remoteServer = remoteServer
  }

  /**
  * Mimicks the SocketWrapper's send method, but expects a message object,
  * instead of a string.
  *
  * Adds additional information to the message that enables the counterparty
  * to identify the sender
  *
  * @param   {Object} message
  *
  * @public
  * @returns {void}
  */
  send (message) {
    if (message.action !== C.ACTIONS.ACK && message.action !== C.ACTIONS.REQUEST) {
      message.isCompleted = true
    }
    this._options.message.sendDirect(
      this._remoteServer, C.TOPIC.RPC_PRIVATE, message, this._metaData
    )
  }

  /**
  * Mimicks the SocketWrapper's sendError method.
  * Sends an error on the specified topic. The
  * action will automatically be set to C.ACTION.ERROR
  *
  * @param {String} topic one of C.TOPIC - ignored in this instance
  * @param {String} type one of C.EVENT
  * @param {String} msg generic error message
  *
  * @public
  * @returns {void}
  */
  sendError (topic, type, msg) {
    if (type === C.EVENT.RESPONSE_TIMEOUT) {
      // by the time an RPC has timed out on this server, it has already timed out on the remote
      // (and has been cleaned up) so no point sending
      return
    }
    this._options.message.sendDirect(this._remoteServer, C.TOPIC.RPC_PRIVATE, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.ERROR,
      data: [type, msg]
    }, this._metaData)
  }
}
