const C = require('../constants/constants')

/**
 * The MessageDistributor routes valid and permissioned messages to
 * various, previously registered handlers, e.g. event-, rpc- or recordHandler
 *
 * @param {Object} options deepstream options
 */
const MessageDistributor = function (options) {
  this._callbacks = new Array(32).map(() => 0)
  this._options = options
}

/**
 * Accepts a socket and a parsed message as input and distributes
 * it to its subscriber, based on the message's topic
 *
 * @param   {SocketWrapper} socket
 * @param   {Object} message parsed and permissioned message
 *
 * @public
 * @returns {void}
 */
MessageDistributor.prototype.distribute = function (socket, message) {
  const callback = this._callbacks[message.topic.charCodeAt(0) - 65]

  if (!callback) {
    this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_TOPIC, message.topic)
    socket.sendError(C.TOPIC.ERROR, C.EVENT.UNKNOWN_TOPIC, message.topic)
    return
  }

  callback(socket, message)
}

/**
 * Allows handlers (event, rpc, record) to register for topics. Subscribes them
 * to both messages passed to the distribute method
 *
 * @param   {String}   topic    One of C.TOPIC
 * @param   {Function} callback The method that should be called for every message
 *                              on the specified topic. Will be called with socket
 *                              and message
 *
 * @public
 * @returns {void}
 */
MessageDistributor.prototype.registerForTopic = function (topic, callback) {
  if (this._callbacks[topic.charCodeAt(0) - 65]) {
    throw new Error(`Callback already registered for topic ${topic}`)
  }

  this._callbacks[topic.charCodeAt(0) - 65] = callback
}

module.exports = MessageDistributor
