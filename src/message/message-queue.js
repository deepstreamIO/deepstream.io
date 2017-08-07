const C = require('../constants/constants')

const STATE = {
  IDLE: 0,
  ASYNC: 1,
  SYNC: 2,
  WAITING: 3
}

module.exports = class MessageQueue {
  constructor (options, socket) {
    this._permissionHandler = options.permissionHandler
    this._logger = options.logger
    this._socket = socket
    this._messages = []
    this._message = {
      raw: undefined,
      topic: undefined,
      action: undefined,
      data: undefined
    }
    this._index = 0
    this._state = STATE.IDLE

    this._onResponse = this._onResponse.bind(this)
  }

  onAuthenticatedMessage (socketWrapper, message) {
  }

  process (rawMessage) {
    this._messages.push(...rawMessage.split(C.MESSAGE_SEPERATOR))

    if (this._state === STATE.IDLE) {
      this._next()
    }
  }

  _onResponse (error, result) {
    if (error) {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString())
      this._sendError(C.EVENT.MESSAGE_PERMISSION_ERROR, this._message)
    } else if (!result) {
      this._sendError(C.EVENT.MESSAGE_DENIED, this._message)
    } else {
      this.onAuthenticatedMessage(this._socket, this._message)
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
      const rawMessage = this._messages[this._index++]

      if (rawMessage === undefined) {
        this._index = 0
        this._state = STATE.IDLE
        this._messages.length = 0
        break
      }

      if (rawMessage.length < 3) {
        continue
      }

      const parts = rawMessage.split(C.MESSAGE_PART_SEPERATOR)

      if (parts.length < 2) {
        this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PARSE_ERROR, rawMessage)
        this._socket.sendError(C.TOPIC.ERROR, C.EVENT.MESSAGE_PARSE_ERROR, rawMessage)
        continue
      }

      if (parts[0] === C.TOPIC.CONNECTION && parts[1] === C.ACTIONS.PONG) {
        return
      }

      this._message.raw = rawMessage
      this._message.topic = parts[0]
      this._message.action = parts[1]
      this._message.data = parts.splice(2)

      // Determine (STATE.WAITING) if canPerformAction is executed synchronously (STATE.SYNC) or
      // (STATE.ASYNC) asynchronously.
      // If executed synchronously we can iteratively continue processing messages otherwise
      // break and continue once callback is invoked asynchronously.
      // This avoids deep recursion and stackoverflow when canPerformAction invokes the callback
      // synchronously.
      this._state = STATE.WAITING

      this._permissionHandler.canPerformAction(
        this._socket.user,
        this._message,
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
