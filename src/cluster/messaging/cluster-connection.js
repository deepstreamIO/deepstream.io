'use strict'

const EventEmitter = require('events').EventEmitter
const MESSAGE = require('./message-enums')
const utils = require('../../utils/utils')
const C = require('../../constants/constants')

const STATE = {
  INIT: 0,
  UNIDENTIFIED: 1,
  IDENTIFIED: 2,
  STABLE: 3,
  CLOSED: 4,
  REJECTED: 5,
  ERROR: 6
}

const STATE_LOOKUP = utils.reverseMap(STATE)
const MESSAGE_LOOKUP = utils.reverseMap(MESSAGE)

/* eslint-disable class-methods-use-this */

class ClusterConnection extends EventEmitter {
  constructor (config, logger) {
    super()
    this._logger = logger
    this._config = config
    this.remoteName = null
    this.remoteUrl = null
    this.localName = config.serverName
    this.localUrl = `${config.host}:${config.port}`
    this.STATE = STATE
    this._state = STATE.INIT
    this._readBuffer = ''
  }

  getRemoteUrl () {
    return `${this._socket.remoteAddress}:${this._socket.remotePort}`
  }

  isIdentified () {
    return this._state === this.STATE.IDENTIFIED || this._state === this.STATE.STABLE
  }

  isStable () {
    return this._state === this.STATE.STABLE
  }

  isAlive () {
    return this._state === this.STATE.UNIDENTIFIED
      || this._state === this.STATE.IDENTIFIED
      || this._state === this.STATE.STABLE
  }

  _send (topic, messageOpt) {
    const message = messageOpt || ''
    if (topic !== MESSAGE.PING && topic !== MESSAGE.PONG) {
      const error = `->(${this.remoteName}) ${MESSAGE_LOOKUP[topic]} ${message}`
      this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, error)
    }
    this._socket.write(topic + message + MESSAGE.MESSAGE_SEPERATOR, 'utf8')
  }

  setRemoteDetails (name, electionNumber, url) {
    this.remoteName = name
    this.electionNumber = electionNumber
    if (url) {
      this.remoteUrl = url
    }
    this._stateTransition(STATE.IDENTIFIED)
  }

  close () {
    if (this.isAlive()) {
      this._socket.setKeepAlive(false)
      this._send(MESSAGE.CLOSE)
      this._socket.end()
    } else {
      this._onClose()
    }
  }

  destroy () {
    if (this._state !== STATE.CLOSED) {
      this._socket.setKeepAlive(false)
      this._socket.destroy()
    }
  }

  sendWho (identificationData) {
    this._send(MESSAGE.WHO, JSON.stringify(identificationData))
  }

  sendIAm (identificationData) {
    this._send(MESSAGE.IAM, JSON.stringify(identificationData))
  }

  sendKnown (identificationData) {
    this._send(MESSAGE.KNOWN, JSON.stringify(identificationData))
  }

  sendReject (reason) {
    this._send(MESSAGE.REJECT, reason)
    this.close()
  }

  sendRejectDuplicate () {
    this._send(MESSAGE.REJECT_DUPLICATE_CONNECTION)
    this.close()
  }

  sendMessage (message) {
    this._send(MESSAGE.MSG, JSON.stringify(message))
  }

  _stateTransition (nextState) {
    {
      const current = STATE_LOOKUP[this._state]
      const next = STATE_LOOKUP[nextState]
      if (!current || !next) {
        this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.INVALID_STATE_TRANSITION, nextState)
      }
      this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, `connection ${this.remoteUrl} state transition ${current} -> ${next}`)
    }
    this._state = nextState
  }

  _configureSocket () {
    this._socket.setEncoding('utf8')
    this._socket.setKeepAlive(true, 2000)
    this._socket.setNoDelay(true)
    this._socket.on('error', this._onSocketError.bind(this))
    this._socket.on('data', this._onData.bind(this))
    this._socket.on('close', this._onClose.bind(this))
    this._socket.on('connect', this._onConnect.bind(this))
  }

  _onData (data) {
    const readBuffer = this._readBuffer + data
    this._readBuffer = ''
    let readIndex = 0
    let splitIndex
    while (readIndex < readBuffer.length) {
      splitIndex = readBuffer.indexOf(MESSAGE.MESSAGE_SEPERATOR, readIndex)
      if (splitIndex === -1) {
        this._readBuffer = readBuffer.slice(readIndex)
        return
      }
      this._onMessage(readBuffer.slice(readIndex, splitIndex))
      readIndex = splitIndex + 1
    }
  }

  _onMessage (prefixedMessage) {
    const topic = prefixedMessage[0]
    const message = prefixedMessage.slice(1)
    if (topic !== MESSAGE.PING && topic !== MESSAGE.PONG) {
      const topicStr = MESSAGE_LOOKUP[topic]
      this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, `<-(${this.remoteName}) ${topicStr} ${message}`)
    }

    if (topic === MESSAGE.PING) {
      this._handlePing(message)
      return
    } else if (topic === MESSAGE.PONG) {
      this._handlePong(message)
      return
    } else if (topic === MESSAGE.CLOSE) {
      this._socket.end()
      return
    } else if (topic === MESSAGE.REJECT) {
      this._handleReject(message)
      return
    } else if (topic === MESSAGE.REJECT_DUPLICATE_CONNECTION) {
      this._handleRejectDuplicate()
      return
    } else if (topic === MESSAGE.ERROR) {
      this._handleError(message)
      return
    }
    let parsedMessage
    try {
      parsedMessage = JSON.parse(message)
    } catch (err) {
      // send error message
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INVALID_MSGBUS_MESSAGE, `malformed json ${message}`)
      process.exit(1)
      return
    }
    if (topic === MESSAGE.WHO) {
      this.emit('who', parsedMessage)
    } else if (topic === MESSAGE.IAM) {
      this.emit('iam', parsedMessage)
    } else if (topic === MESSAGE.KNOWN) {
      this.emit('known', parsedMessage)
      this._onKnown()
    } else if (topic === MESSAGE.MSG) {
      this.emit('message', parsedMessage)
    } else {
      this.emit('error', `unknown message topic ${topic}`)
    }
  }

  _onKnown () {
    if (this._state === this.STATE.IDENTIFIED) {
      this._stateTransition(this.STATE.STABLE)
    }
  }

  _handleWho (message) {
    let data
    try {
      data = JSON.parse(message)
    } catch (err) {
      this.emit('error', 'failed to parse identify message')
      this._send(MESSAGE.ERROR, 'failed to parse identify message')
      return
    }
    this._stateTransition(STATE.IDENTIFIED)
    this.emit('identify', data)
  }

  _handleReject (reason) {
    // TODO: else warn
    this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INFO, `connection rejected with reason: ${reason}`)
    this._stateTransition(STATE.REJECTED)
  }

  _handleRejectDuplicate () {
    this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, 'duplicate connection rejected')
  }

  _handleError (error) {
    // TODO: handle e.g. malformed message errors, probably just log
    this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INFO, `an error message was received: ${error}`)
  }

  _onSocketError () {
    throw new Error('not implemented')
  }

  _onConnect () {
    throw new Error('not implemented')
  }

  _onClose () {
    this._stateTransition(STATE.CLOSED)
    this.emit('close')
  }
}

module.exports = ClusterConnection
