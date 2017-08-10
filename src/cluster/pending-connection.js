const EventEmitter = require('events').EventEmitter
const MESSAGE = require('./message-enums')
const ERRORS = require('./errors')

/**
 * This class serves as a quarantine area for connections that
 * are established, but not yet authenticated.
 *
 * If the connection passes authentication this class will emit
 * an 'open' event after which the message connector will elevate
 * the connection to a trusted connection.
 *
 * After both success and failure the class destroys itself and removes
 * all outside listeners attached to it
 *
 * @constructor
 * @extends {events.EventEmitter}
 *
 * @param {Connection} connection   An Incoming- or OutgoingConnection
 * @param {MessageConnector} messageConnector
 */
class PendingConnection extends EventEmitter {

  constructor (connection, messageConnector) {
    super()
    this._connection = connection
    this._messageConnector = messageConnector
    this._completeFn = this._complete.bind(this)
    this._onMessageFn = this._onMessage.bind(this)

    this._connection.on('close', this._completeFn)
    this._connection.on('error', this._completeFn)
    this._connection.on('msg', this._onMessageFn)

    this._connectionTimeout = setTimeout(this._completeFn, 2000)
    this._sendIdentification()
  }

  /**
   * Sends the identification message, consisting of this instance's uid
   * and securityToken
   *
   * @private
   * @returns {void}
   */
  _sendIdentification () {
    const identificationData = {
      uid: this._messageConnector.getUid(),
      securityToken: this._messageConnector.getSecurityToken()
    }

    this._connection.send(MESSAGE.IDENTIFY + JSON.stringify(identificationData))
  }

  /**
   * Listener for messages that are received prior to authentication.
   *
   * Expected messages are the identification message, containing the name
   * of the remote deepstream instance and its security token or a rejection
   * message
   *
   * @param   {String} msg A message, prefixed with the single letter message type
   *
   * @private
   * @returns {void}
   */
  _onMessage (msg) {
    if (msg.length < 2) {
      this._reject(ERRORS.INVALID_MESSAGE)
      return
    }

    let msgType = msg[0],
      msgData = msg.substr(1)

    if (msgType === MESSAGE.IDENTIFY) {
      this._checkIdentification(msgData)
    }
    else if (msgType === MESSAGE.REJECT) {
      this._onRejected(msgData)
    }
    else if (msgType === MESSAGE.ERROR) {
      this._connection.emit('error', msgData)
    }
  }

  /**
   * Checks the content of the identification message. The identification
   * message is a JSON string with the following structure
   *
   * {
   *    securityToken: "<String>",
   *    uid: "<String>"
   * }
   *
   * @param   {String} msg The JSON encoded indentification message
   *
   * @private
   * @returns {void}
   */
  _checkIdentification (msg) {
    let data

    // Is the message parseable ?
    try {
      data = JSON.parse(msg)
    } catch (e) {
      this._reject(ERRORS.MESSAGE_PARSE_ERROR)
      return
    }

    // Is the securityToken the same as this instance's security token ?
    if (data.securityToken !== this._messageConnector.getSecurityToken()) {
      this._reject(ERRORS.INVALID_SECURITY_TOKEN)
      return
    }

    // Is this instance already connected to the remote instance
    if (this._messageConnector.isConnectedToPeer(data.uid)) {
      this._reject(ERRORS.DUPLICATE_CONNECTION)
      return
    }

    // All good, open the connection
    this._connection.remoteUid = data.uid
    this.emit('open', this._connection)
    this._complete()
  }

  /**
   * Rejects a message. This sends a rejection message to the remote
   * instance and then closes the connection.
   *
   * The rejection message will tell the remote instance that the connection
   * was closed on purpose and that it shouldn't try to reconnect
   *
   * @param   {String} reason
   *
   * @private
   * @returns {void}
   */
  _reject (reason) {
    this._connection.send(MESSAGE.REJECT + reason)
    setTimeout(this._destroyConnection.bind(this), 20)
  }

  /**
   * Destroys the connection and this class if it wasn't already destroyed
   *
   * @private
   * @returns {void}
   */
  _destroyConnection () {
    if (!this._connection) {
      return
    }

    this._connection.destroy()
    this._complete()
  }

  /**
   * Handler for received rejection messages. Emit's the rejection
   * as an error event and destroys this class
   *
   * @param   {String} reason
   *
   * @private
   * @returns {void}
   */
  _onRejected (reason) {
    const msg = `Connection to ${this._connection.getRemoteUrl()} was rejected due to ${reason}`

    if (reason !== ERRORS.DUPLICATE_CONNECTION) {
      this._messageConnector.emit('error', msg)
    }

    this._connection.destroy()
    this._connection.isRejected = true
    this._complete()
  }

  /**
   * Destroys this class. Removes all the listeners it previously attached
   * and null down references to external objects
   *
   * @param   {Connection} connection Incoming or Outgoing Connection
   *
   * @private
   * @returns {void}
   */
  _complete (connection) {
    clearTimeout(this._connectionTimeout)
    this.removeAllListeners()
    this._connection.removeListener('close', this._completeFn)
    this._connection.removeListener('error', this._completeFn)
    this._connection.removeListener('msg', this._onMessageFn)
    this._connection = null
    this._messageConnector = null
  }
}

module.exports = PendingConnection
