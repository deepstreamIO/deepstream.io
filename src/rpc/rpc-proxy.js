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
  constructor (options, remoteServer) {
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
    this._options.message.sendDirect(this._remoteServer, C.TOPIC.PRIVATE + C.TOPIC.RPC, message)
    message.isCompleted = true
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
    this._options.message.sendDirect(this._remoteServer, C.TOPIC.PRIVATE + topic, {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.ERROR,
      data: [type, msg]
    })
  }
}
