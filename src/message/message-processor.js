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
    let message

    const length = parsedMessages.length
    for (let i = 0; i < length; i++) {
      message = parsedMessages[i]

      if (message.topic === C.TOPIC.CONNECTION && message.action === C.ACTIONS.PONG) {
        continue
      }

      if (message === null ||
        !message.action ||
        !message.topic ||
        !message.data) {
        this._options.logger.warn(C.EVENT.MESSAGE_PARSE_ERROR, message)
        socketWrapper.sendError({
          topic: C.TOPIC.ERROR
        }, C.EVENT.MESSAGE_PARSE_ERROR, message)
        continue
      }

      if (message.isAck) {
        this._onPermissionResponse(socketWrapper, message, null, true)
        return
      }

      this._options.permissionHandler.canPerformAction(
        socketWrapper.user,
        message,
        this._onPermissionResponse.bind(this, socketWrapper, message),
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
      socketWrapper.sendError(message, C.EVENT.MESSAGE_PERMISSION_ERROR)
      return
    }

    if (result !== true) {
      socketWrapper.sendError(message, C.EVENT.MESSAGE_DENIED)
      return
    }

    this.onAuthenticatedMessage(socketWrapper, message)
  }

}
