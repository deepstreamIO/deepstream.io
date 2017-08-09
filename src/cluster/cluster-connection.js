const EventEmitter = require('events').EventEmitter
const MESSAGE = require('./message-enums')
const utils = require('../utils/utils')

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

/* eslint-disable class-methods-use-this */

class ClusterConnection extends EventEmitter
{
  constructor (config) {
    super()
    this._config = config
    this.remoteName = null
    this.remoteUrl = null
    this.localName = config.serverName
    this.localUrl = `${config.host}:${config.port}`
    this.STATE = STATE
    this._state = STATE.INIT
  }

  getRemoteUrl () {
    return `${this._socket.remoteAddress}:${this._socket.remotePort}`
  }

  isStable () {
    return this._state === this.STATE.STABLE
  }

  send (topic, message) {
    this._socket.write(topic + message + MESSAGE.MESSAGE_SEPERATOR, 'utf8')
  }

  close () {
    if (this._state !== STATE.CLOSED) {
      this._socket.setKeepAlive(false)
      this._socket.end(MESSAGE.CLOSE)
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
    this.send(MESSAGE.WHO, JSON.stringify(identificationData))
  }

  sendIAm (identificationData) {
    this.send(MESSAGE.IAM, JSON.stringify(identificationData))
  }

  sendKnown (identificationData) {
    this.send(MESSAGE.KNOWN, JSON.stringify(identificationData))
  }

  sendReject (reason) {
    this.send(MESSAGE.REJECT, reason)
    this.close()
  }

  _stateTransition (nextState) {
    {
      const current = STATE_LOOKUP[this._state]
      const next = STATE_LOOKUP[nextState]
      console.log(`connection ${this.remoteName} state transition ${current} -> ${next}`)
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
    this._socket.on('connect', this.emit.bind(this, 'connect'))
  }

  _onData (data) {
    const messages = data.split(MESSAGE.MESSAGE_SEPERATOR)
    for (let i = 0; i < messages.length - 1; i++) {
      this._onMessage(messages[i])
    }
  }

  _onMessage (prefixedMessage) {
    const topic = prefixedMessage[0]
    const message = prefixedMessage.slice(1)
    if (topic === MESSAGE.CLOSE) {
      this._onClose()
      return
    } else if (topic === MESSAGE.REJECT) {
      this._handleReject(message)
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
      console.error('malformed json', message)
      return
    }
    if (topic === MESSAGE.WHO) {
      console.log('WHO', message)
      this.emit('who', parsedMessage)
    } else if (topic === MESSAGE.IAM) {
      console.log('IAM', message)
      this.emit('iam', parsedMessage)
    } else if (topic === MESSAGE.KNOWN) {
      console.log('KNOWN', message)
      this.emit('known', parsedMessage)
    } else {
      this.emit('message', topic, parsedMessage)
    }
  }

  _handleWho (message) {
    let data
    try {
      data = JSON.parse(message)
    } catch (err) {
      this.emit('error', 'failed to parse identify message')
      this.send(MESSAGE.ERROR, 'failed to parse identify message')
      return
    }
    this._stateTransition(STATE.IDENTIFIED)
    this.emit('identify', data)
  }

  _handleReject (reason) {
    // TODO: if reason is because we're already connected, do nothing (perhaps add REJECT_DUPLICATE
    // message for that?)
    // TODO: else warn
    console.error('connection rejected with reason:', reason)
    this._stateTransition(STATE.REJECTED)
  }

  _handleError (error) {
    // TODO: handle e.g. malformed message errors, probably just log
    console.error('an error message was received:', error)
  }

  _onSocketError () {} // eslint-disable-line

  _onClose () {
    this._stateTransition(STATE.CLOSED)
    this.emit('close')
  }
}

module.exports = ClusterConnection
