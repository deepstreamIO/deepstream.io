const net = require('net')
const MESSAGE = require('./message-enums')
const ClusterConnection = require('./cluster-connection')

/**
 * Represents a TCP connection made by this deepstream instance
 * to another deepstream instance. It is the Outgoing Connection's
 * responsibility to handle reconnection if the connection is lost.
 *
 * @constructor
 * @extends {ClusterConnection}
 *
 * @param {String} url    A basic URL without protocol <host>:<port>
 * @param {Object} config The configuration as passed to the MessageConnector
 */
class OutgoingConnection extends ClusterConnection {
  constructor (url, config) {
    super(config)

    this.remoteUrl = url
    this._config = config
    this._params = this._parseUrl(url)
    this._connectionAttempts = 0
    this._socket = null
    this._reconnectTimeout = null
    this._createSocket()
    this.once('identify', () => this._stateTransition(this.STATE.STABLE))
  }

  /**
   * Creates the socket, based on the connection parameters
   *
   * @private
   * @returns {void}
   */
  _createSocket () {
    this._socket = net.createConnection(this._params)
    this._stateTransition(this.STATE.UNIDENTIFIED)
    this._configureSocket()
  }

  /**
   * Listener for socket errors.
   *
   * If the connection is lost, but not rejected, this class
   * will attempt to reconnect
   *
   * @param   {Error} error
   *
   * @private
   * @returns {void}
   */
  _onSocketError (error) {
    if (error.code === 'ECONNREFUSED' && this._state !== this.STATE.REJECTED) {
      this._scheduleReconnect()
    } else {
      this.emit('error', error)
    }
  }

  /**
   * Schedules the next reconnection attempt. If the number of failed attempts
   * exceeds the considered threshold no additional attempts will be made
   * and the connection emits an error event
   *
   * @private
   * @returns {void}
   */
  _scheduleReconnect () {
    this._connectionAttempts++

    if (this._connectionAttempts <= this._config.maxReconnectAttempts) {
      this._destroySocket()
      this._reconnectTimeout = setTimeout(
        this._createSocket.bind(this),
        this._config.reconnectInterval
      )
    } else {
      this.emit('error', `max reconnection attempts (${this._config.maxReconnectAttempts}) exceeded`)
    }
  }

  /**
   * Parses the provided url strings and constructs a connection parameter
   * object. If a localhost and -port is specified, it will be used, otherwise
   * the system will work out the local port itself
   *
   * @param {String} url    A basic URL without protocol <host>:<port>
   *
   * @private
   * @returns {Object} connectionParameter
   */
  _parseUrl (url) {
    const splitIdx = url.lastIndexOf(':')

    const params = {
      host: url.slice(0, splitIdx),
      port: url.slice(splitIdx + 1)
    }

    if (this._config.localHost && this._config.localPort) {
      params.localAddress = `${this._config.localHost}:${this._config.localPort}`
    }

    if (!params.host || !params.port) {
      this.emit('error', `invalid URL ${url}`)
      return null
    }
    return params
  }

  close () {
    clearTimeout(this._reconnectTimeout)
    super.close()
  }

  /**
   * Destroys the connection
   *
   * @private
   * @returns {void}
   */
  _destroySocket () {
    clearTimeout(this._reconnectTimeout)
    this._socket.destroy()
    this._socket.removeAllListeners()
  }
}

module.exports = OutgoingConnection
