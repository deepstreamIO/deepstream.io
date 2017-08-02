const messageParser = require('./message-parser')
const C = require('../constants/constants')

const STATE = {
  IDLE: 0,
  ASYNC: 1,
  SYNC: 2,
  WAITING: 3
}

module.exports = class MessageQueue {
  constructor (options, socket) {
    this._processor = options.processor
    this._permissionHandler = options.permissionHandler
    this._logger = options.logger
    this._socket = socket
    this._messages = []
    this._index = 0
    this._state = STATE.IDLE

    this._onMessage = this._onMessage.bind(this)
    this._onResponse = this._onResponse.bind(this)
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
  onAuthenticatedMessage (socketWrapper, message) {
  }

  /**
   * This method is the way the message queue accepts input. It receives arrays
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
  process (rawMessage) {
    messageParser.parse(rawMessage, this._onMessage)
  }

  _onMessage (message, rawMessage) {
    if (!message) {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PARSE_ERROR, rawMessage)
      this._socket.sendError(C.TOPIC.ERROR, C.EVENT.MESSAGE_PARSE_ERROR, rawMessage)
      return
    }

    if (message.topic === C.TOPIC.CONNECTION && message.action === C.ACTIONS.PONG) {
      return
    }

    this._messages.push(message)

    if (this._state !== STATE.IDLE) {
      return
    }

    this._next()
  }

  _onResponse (error, result) {
    const message = this._messages[this._index]

    this._messages[this._index++] = undefined

    if (error) {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString())
      this._sendError(C.EVENT.MESSAGE_PERMISSION_ERROR, message)
    } else if (!result) {
      this._sendError(C.EVENT.MESSAGE_DENIED, message)
    }

    if (!error && result) {
      this.onAuthenticatedMessage(this._socket, message)
    }

    if (this._state === STATE.WAITING) {
      this._state = STATE.SYNC
    } else if (this._state === STATE.ASYNC) {
      this._next()
    } else {
      throw new Error(`invalid message queue state ${this._state}`)
    }
  }

  _next () {
    while (true) {
      const message = this._messages[this._index]

      if (!message) {
        this._index = 0
        this._state = STATE.IDLE
        this._messages.splice(0, this._messages.length)
        break
      }

      // Determine (STATE.WAITING) if canPerformAction is executed synchronously (STATE.SYNC) or
      // (STATE.ASYNC) asynchronously.
      // If executed synchronously we can iteratively continue processing messages otherwise
      // break and continue once callback is invoked asynchronously.
      // This avoids deep recursion and stackoverflow when canPerformAction invokes the callback
      // synchronously.
      this._state = STATE.WAITING

      this._permissionHandler.canPerformAction(
        this._socket.user,
        message,
        this._onResponse,
        this._socket.authData
      )

      if (this._state === STATE.WAITING) {
        this._state = STATE.ASYNC
        break
      }
    }
  }

  _sendError (event, message) {
    let data = [ message.data[0], message.action ]
    if (message.data.length > 1) {
      data = data.concat(message.data.slice(1))
    }
    this._socket.sendError(message.topic, event, data)
  }
}
