'use strict'

const EventEmitter = require('events').EventEmitter
const messageHandler = require('./message-handler')
const MC = require('./message-constants')
const utils = require('../../utils/utils')
const C = require('../../constants/constants')

const CLUSTER_ACTION_BYTES = MC.ACTIONS_BYTES.CLUSTER
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
    this._readBuffer = null
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
      this._sendCluster(CLUSTER_ACTION_BYTES.CLOSE)
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
    this._sendCluster(CLUSTER_ACTION_BYTES.IDENTIFICATION_REQUEST, identificationData)
  }

  sendIAm (identificationData) {
    this._sendCluster(CLUSTER_ACTION_BYTES.IDENTIFICATION_RESPONSE, identificationData)
  }

  sendKnown (identificationData) {
    this._sendCluster(CLUSTER_ACTION_BYTES.KNOWN_PEERS, identificationData)
  }

  sendReject (reason) {
    this._sendCluster(CLUSTER_ACTION_BYTES.REJECT, { reason })
    this.close()
  }

  sendRejectDuplicate () {
    this._sendCluster(CLUSTER_ACTION_BYTES.REJECT_DUPLICATE)
    this.close()
  }

  send (topic, action, message) {
    const processedMsg = messageHandler.preprocessMsg(topic, action, message)
    this._sendBytes(processedMsg.topicByte, processedMsg.actionByte, processedMsg.data)
  }

  _sendCluster (action, message) {
    if (action !== CLUSTER_ACTION_BYTES.PING && action !== CLUSTER_ACTION_BYTES.PONG) {
      const actionStr = MC.ACTIONS_BYTE_TO_KEY.CLUSTER[action]
      const messageStr = message && JSON.stringify(message).slice(0, 30)
      const debugMsg = `->(${this.remoteName}) ${actionStr}: ${messageStr}...)`
      this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, debugMsg)
    }
    this._sendBytes(MC.TOPIC_BYTES.CLUSTER, action, message)
  }

  _sendBytes (topicByte, actionByte, data) {
    this._socket.write(messageHandler.getBinaryMsg(topicByte, actionByte, data))
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
    this._socket.setKeepAlive(true, 2000)
    this._socket.setNoDelay(true)
    this._socket.on('error', this._onSocketError.bind(this))
    this._socket.on('data', this._onData.bind(this))
    this._socket.on('close', this._onClose.bind(this))
    this._socket.on('connect', this._onConnect.bind(this))
  }

  _onData (data) {
    let readBuffer = this._readBuffer ? Buffer.concat([this._readBuffer, data]) : data
    let result
    do {
      result = messageHandler.tryParseBinaryMsg(readBuffer, this._onBodyParseError.bind(this))
      if (result.bytesConsumed > 0) {
        this._onMessage(result.message)
        readBuffer = readBuffer.slice(result.bytesConsumed)
      }
    } while (readBuffer.length !== 0 && result.bytesConsumed !== 0)
    this._readBuffer = readBuffer.length > 0 ? readBuffer : null
  }

  _onBodyParseError (errMsg, header) {
    const logMsg = `${errMsg} (${JSON.stringify(header)})`
    this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.INVALID_MSGBUS_MESSAGE, logMsg)
    this._socket.destroy(C.EVENT.MESSAGE_PARSE_ERROR)
  }

  _onMessage (message) {
    const topic = message.topicByte
    if (topic === MC.TOPIC_BYTES.CLUSTER) {
      this._handleCluster(message)
      return
    }
    const processedMsg = messageHandler.postprocessMsg(message)
    this.emit('message', processedMsg.topic, processedMsg)
  }

  _handleCluster (message) {
    const topic = message.topicByte
    const action = message.actionByte
    if (action !== CLUSTER_ACTION_BYTES.PING && action !== CLUSTER_ACTION_BYTES.PONG) {
      const topicStr = MC.TOPIC_BYTE_TO_TEXT[topic]
      const actionStr = MC.ACTIONS_BYTE_TO_TEXT.CLUSTER[action]
      const messageStr = message && JSON.stringify(message).slice(0, 30)
      const debugMsg = `<-(${this.remoteName}) ${topicStr} ${actionStr} ${messageStr}...`
      this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, debugMsg)
    }

    if (action === CLUSTER_ACTION_BYTES.PING) {
      this._handlePing(message)
      return
    } else if (action === CLUSTER_ACTION_BYTES.PONG) {
      this._handlePong(message)
      return
    } else if (action === CLUSTER_ACTION_BYTES.CLOSE) {
      this._socket.end()
      return
    } else if (action === CLUSTER_ACTION_BYTES.REJECT) {
      this._handleReject(message)
      return
    } else if (action === CLUSTER_ACTION_BYTES.REJECT_DUPLICATE) {
      this._handleRejectDuplicate()
      return
    } else if (action === CLUSTER_ACTION_BYTES.ERROR) {
      this._handleError(message)
      return
    }
    if (action === CLUSTER_ACTION_BYTES.IDENTIFICATION_REQUEST) {
      this.emit('who', message.body)
    } else if (action === CLUSTER_ACTION_BYTES.IDENTIFICATION_RESPONSE) {
      this.emit('iam', message.body)
    } else if (action === CLUSTER_ACTION_BYTES.KNOWN_PEERS) {
      this.emit('known', message.body)
      this._onKnown()
    } else {
      this.emit('error', `unknown message action ${MC.ACTIONS_BYTE_TO_TEXT.CLUSTER[action]}(0x${action.toString(16)})`)
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
      this._sendCluster(CLUSTER_ACTION_BYTES.ERROR, { message: 'failed to parse identify message' })
      return
    }
    this._stateTransition(STATE.IDENTIFIED)
    this.emit('identify', data)
  }

  _handleReject (message) {
    const reason = message.reason
    // TODO: else warn
    this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INFO, `connection rejected with reason: ${reason}`)
    this._stateTransition(STATE.REJECTED)
  }

  _handleRejectDuplicate () {
    this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, 'duplicate connection rejected')
  }

  _handleError (error) {
    // TODO: handle e.g. malformed message errors, probably just log
    console.log(error)
    this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INFO, `an error message was received: ${JSON.stringify(error)}`)
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
