'use strict'

const C = require('../constants/constants')

/**
 * The MessageDistributor routes valid and permissioned messages to
 * various, previously registered handlers, e.g. event-, rpc- or recordHandler
 *
 * @param {Object} options deepstream options
 */
module.exports = class MessageDistributor {
  constructor(options) {
    this._callbacks = new Map()
    this._options = options
    this._message = options.messageConnector
    this._logger = options.logger
  }

  /**
   * Accepts a socketWrapper and a parsed message as input and distributes
   * it to its subscriber, based on the message's topic
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {Object} message parsed and permissioned message
   *
   * @public
   * @returns {void}
   */
  distribute(socketWrapper, message) {
    if (!this._callbacks.has(message.topic)) {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_TOPIC, message.topic)
      socketWrapper.sendError(C.TOPIC.ERROR, C.EVENT.UNKNOWN_TOPIC, message.topic)
      return
    }

    socketWrapper.emit(message.topic, message)

    if (message.isCompleted !== true) {
      this._callbacks.get(message.topic)(socketWrapper, message)
    }
  }

  /**
   * Allows handlers (event, rpc, record) to register for topics. Subscribes them
   * to both messages passed to the distribute method as well as messages received
   * from the messageConnector
   *
   * @param   {String}   topic    One of C.TOPIC
   * @param   {Function} callback The method that should be called for every message
   *                              on the specified topic. Will be called with socketWrapper
   *                              and message
   *
   * @public
   * @returns {void}
   */
  registerForTopic(topic, callback) {
    if (this._callbacks.has(topic)) {
      throw new Error(`Callback already registered for topic ${topic}`)
    }

    this._callbacks.set(topic, callback)
    this._message.subscribe(topic, (message) => callback(C.SOURCE_MESSAGE_CONNECTOR, message))
  }
}
