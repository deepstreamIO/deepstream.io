'use strict'

const ClusterConnection = require('./cluster-connection')
const MC = require('./message-constants')

class IncomingConnection extends ClusterConnection {
  constructor (socket, config, logger) {
    super(config, logger)

    this._socket = socket
    this._configureSocket()
    this._pingTimeoutId = null
    this._onPingTimeoutBound = this._onPingTimeout.bind(this)
  }

  sendIdResponse (identificationData) {
    this._sendCluster(MC.ACTIONS_BYTES.CLUSTER.IDENTIFICATION_RESPONSE, identificationData)
  }

  clearTimeouts () {
    clearTimeout(this._pingTimeoutId)
  }

  _onConnect () {
    this._pingTimeoutId = setTimeout(this._onPingTimeoutBound, this._config.pingTimeout)
    this.emit('connect')
  }

  _handlePing () {
    clearTimeout(this._pingTimeoutId)
    if (this.isAlive()) {
      this._sendCluster(MC.ACTIONS_BYTES.CLUSTER.PONG)
      this._pingTimeoutId = setTimeout(
        this._onPingTimeoutBound,
        this._config.pingInterval + this._config.pingTimeout
      )
    } else {
      this.destroy()
    }
  }

  _onPingTimeout () {
    if (this.isAlive()) {
      this.emit('error', `connection did not receive a PING in ${
        this._config.pingInterval + this._config.pingTimeout
      }ms`)
      this.destroy()
    }
  }

  _onSocketError (error) {
    this.emit('error', error)
  }
}

module.exports = IncomingConnection
