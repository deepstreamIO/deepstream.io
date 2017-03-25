'use strict'

const MessageQueue = require('./message-queue')

/**
 * The MessageProcessor consumes blocks of parsed messages emitted by the
 * ConnectionEndpoint, checks if they are permissioned and - if they
 * are - forwards them.
 *
 * @constructor
 *
 * @param {Object} options deepstream options
 */
module.exports = class MessageProcessor {
  constructor (options) {
    this._options = options
    this._queues = new Map()
  }

  /**
   * There will only ever be one consumer of forwarded messages. So rather than using
   * events - and their performance overhead - the messageProcessor exposes
   * this method that's expected to be overwritten.
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {Object} message the parsed message
   *
   * @overwrite
   *
   * @returns {void}
   */
  onAuthenticatedMessage (socketWrapper, message) { // eslint-disable-line
  }

  /**
   * This method is the way the message processor accepts input. It receives arrays
   * of parsed messages, iterates through them and issues permission requests for
   * each individual message
   *
   * @todo The responses from the permissionHandler might arive in any arbitrary order - order them
   * @todo Handle permission handler timeouts
   *
   * @param   {SocketWrapper} socketWrapper
   * @param   {Object} message parsed message
   *
   * @returns {void}
   */
  process(socketWrapper, message) {
    let queue = this._queues.get(socketWrapper)
    if (!queue) {
      queue = new MessageQueue(this._options, socketWrapper)
      queue.onAuthenticatedMessage = this.onAuthenticatedMessage
      socketWrapper.once('close', (socketWrapper) => this._queues.delete(socketWrapper))
      this._queues.set(socketWrapper, queue)
    }
    queue.process(message)
  }

  /**
   * Create data in the correct format expected in a MESSAGE_DENIED or MESSAGE_PERMISSION_ERROR
   *
   * @param   {Object} message  parsed message - might have been manipulated
   *                              by the permissionHandler
   * @returns {Object}
   */
  _getPermissionErrorData (message) { // eslint-disable-line
    let data = [message.data[0], message.action]
    if (message.data.length > 1) {
      data = data.concat(message.data.slice(1))
    }
    return data
  }
}
