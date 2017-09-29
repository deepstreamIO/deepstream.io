const C = require('../constants/constants')

const STATE = {
  IDLE: 0,
  ASYNC: 1,
  SYNC: 2,
  WAITING: 3
}

const PONG_MSG = `${C.TOPIC.CONNECTION}${C.MESSAGE_PART_SEPERATOR}${C.ACTIONS.PONG}${C.MESSAGE_SEPERATOR}`

module.exports = class MessageQueue {
  constructor (options, socket) {
    this._permissionHandler = options.permissionHandler
    this._logger = options.logger
    this._socket = socket
    this._raw = ''
    this._msg = null
    this._state = STATE.IDLE

    this._onResponse = this._onResponse.bind(this)
  }

  onAuthenticatedMessage (socketWrapper, message) {
  }

  process (rawMessage) {
    this._raw += rawMessage

    if (this._state === STATE.IDLE) {
      this._next()
    }
  }

  _onResponse (error, result) {
    if (error) {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString())
      this._sendError(C.EVENT.MESSAGE_PERMISSION_ERROR, this._msg)
    } else if (!result) {
      this._sendError(C.EVENT.MESSAGE_DENIED, this._msg)
    } else {
      this.onAuthenticatedMessage(this._socket, this._msg)
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
      if (this._raw.startsWith(PONG_MSG)) {
        this._raw = this._raw.slice(PONG_MSG.length)
        continue
      }

      const idx = this._raw.indexOf(C.MESSAGE_SEPERATOR)
      if (idx === -1) {
        this._state = STATE.IDLE
        this._raw = ''
        break
      }

      this._msg = this._raw.slice(0, idx)
      this._raw = this._raw.slice(idx + 1)

      // Determine (STATE.WAITING) if canPerformAction is executed synchronously (STATE.SYNC) or
      // (STATE.ASYNC) asynchronously.
      // If executed synchronously we can iteratively continue processing messages otherwise
      // break and continue once callback is invoked asynchronously.
      // This avoids deep recursion and stackoverflow when canPerformAction invokes the callback
      // synchronously.
      this._state = STATE.WAITING

      this._permissionHandler.canPerformAction(
        this._socket.user,
        this._msg,
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
    this._socket.sendError(null, event, message)
  }
}
