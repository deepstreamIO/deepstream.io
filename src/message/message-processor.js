'use strict'

const C = require('../constants/constants')

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
  process (socketWrapper, parsedMessages) {
    let parsedMessage

    const length = parsedMessages.length
    for (let i = 0; i < length; i++) {
      parsedMessage = parsedMessages[i]

      if (parsedMessage.topic === C.TOPIC.CONNECTION && parsedMessage.action === C.ACTIONS.PONG) {
        continue
      }

      if (parsedMessage === null ||
        !parsedMessage.action ||
        !parsedMessage.topic ||
        !parsedMessage.data) {
        this._options.logger.warn(C.EVENT.MESSAGE_PARSE_ERROR, parsedMessage)
        socketWrapper.sendError(C.TOPIC.ERROR, C.EVENT.MESSAGE_PARSE_ERROR, parsedMessage)
        continue
      }

      this._options.permissionHandler.canPerformAction(
        socketWrapper.user,
        parsedMessage,
        this._onPermissionResponse.bind(this, socketWrapper, parsedMessage),
        socketWrapper.authData
      )
    }
  }

  /**
   * Processes the response that's returned by the permissionHandler.
   *
   * @param   {SocketWrapper}   socketWrapper
   * @param   {Object} message  parsed message - might have been manipulated
   *                              by the permissionHandler
   * @param   {Error} error     error or null if no error. Denied permissions will be expressed
   *                            by setting result to false
   * @param   {Boolean} result    true if permissioned
   *
   * @returns {void}
   */
  _onPermissionResponse (socketWrapper, message, error, result) {
    if (error !== null) {
      this._options.logger.warn(C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString())
      socketWrapper.sendError(
        message.topic,
        C.EVENT.MESSAGE_PERMISSION_ERROR,
        this._getPermissionErrorData(message)
      )
      return
    }

    if (result !== true) {
      socketWrapper.sendError(
        message.topic,
        C.EVENT.MESSAGE_DENIED,
        this._getPermissionErrorData(message)
      )
      return
    }

    this.onAuthenticatedMessage(socketWrapper, message)
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
