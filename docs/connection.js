const C = require('./constants')
const { EventEmitter } = require('events')
const WebSocket = require('websocket')

export class Connection extends EventEmitter {
  constructor (url, options) {
    super()
    this._url = url
    this._options = options
    this._state = C.CONNECTION_STATE.CLOSED
    this._createEndpoint()
  }

  authenticate (authParams, callback) {
    this._authParams = authParams
    this._authCallback = callback

    if (this._state === C.CONNECTION_STATE.AWAITING_AUTHENTICATION) {
      this._sendAuthParams()
    }
  }

  send (topic, action, data) {
    if (this._state !== C.CONNECTION_STATE.OPEN) {
      throw new Error('tried to send message on a closed websocket connection')
    }

    this._endpoint.send(buildMessage(topic, action, data))
  }

  _createEndpoint () {
    this._endpoint = new WebSocket(this._url)
    this._endpoint.onopen = this._onOpen
    this._endpoint.onerror = this._onError
    this._endpoint.onclose = this._onClose
    this._endpoint.onmessage = this._onMessage
  }

  _onOpen () {
    this._state = C.CONNECTION_STATE.AWAITING_CONNECTION
  }

  _onError (error) {
    this._state = C.CONNECTION_STATE.ERROR
    this.emit('error', error)
  }

  _onClose () {
    this._state = C.CONNECTION_STATE.CLOSED
  }

  _onMessage (rawMessage) {
    for (const parsedMessage of parseMessage(rawMessage)) {
      if (!parsedMessage) {
        continue
      } else if (parsedMessage.topic === C.TOPIC.CONNECTION) {
        this._handleConnectionResponse(parsedMessage)
      } else if (parsedMessage.topic === C.TOPIC.AUTH) {
        this._handleAuthResponse(parsedMessage)
      } else {
        this.emit('message', parsedMessage)
      }
    }
  }

  _handleConnectionResponse (message) {
    if (message.action === C.ACTIONS.ACK) {
      this._state = C.CONNECTION_STATE.AWAITING_AUTHENTICATION
      if (this._authParams) {
        this._sendAuthParams()
      }
    } else if (message.action === C.ACTIONS.CHALLENGE) {
      this._state = C.CONNECTION_STATE.CHALLENGING
      this.send(C.TOPIC.CONNECTION, C.ACTIONS.CHALLENGE_RESPONSE, [ this._url ])
    } else if (message.action === C.ACTIONS.REJECTION) {
      this._challengeDenied = true
      this.close()
    } else if (message.action === C.ACTIONS.ERROR) {
      // TODO
    }
  }

  _sendAuthParams () {
    this._state = C.CONNECTION_STATE.AUTHENTICATING
    this.send(C.TOPIC.AUTH, C.ACTIONS.REQUEST, [ this._authParams ])
  }

  _handleAuthResponse (message) {
    if (message.action === C.ACTIONS.ERROR) {
      if (this._authCallback) {
        this._authCallback(false)
      }
    } else if (message.action === C.ACTIONS.ACK) {
      this._state = C.CONNECTION_STATE.OPEN

      if (this._authCallback) {
        this._authCallback(true)
      }
    }
  }
}

function buildMessage (topic, action, data) {
  const sendData = [ topic, action ]

  if (data) {
    for (let i = 0; i < data.length; i++) {
      if (typeof data[i] === 'object') {
        sendData.push(JSON.stringify(data[i]))
      } else {
        sendData.push(data[i])
      }
    }
  }

  return sendData.join(C.MESSAGE_PART_SEPERATOR) + C.MESSAGE_SEPERATOR
}

function parseMessage (message) {
  const parsedMessages = []

  for (const rawMessage of message.split(C.MESSAGE_SEPERATOR)) {
    if (rawMessage.length <= 2) {
      continue
    }

    const parts = message.split(C.MESSAGE_PART_SEPERATOR)

    parsedMessages.push({
      raw: message,
      topic: parts[0],
      action: parts[1],
      data: parts.splice(2)
    })
  }

  return parsedMessages
}
