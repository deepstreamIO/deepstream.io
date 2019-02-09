const fileUtils = require('../../config/file-utils')
const ConnectionEndpoint = require('../websocket/connection-endpoint')
const C = require('../../constants/constants')

const SocketWrapper = require('./socket-wrapper')
const messageBuilder = require('../message-builder')

/**
 * This is the frontmost class of deepstream's message pipeline. It receives
 * connections and authentication requests, authenticates sockets and
 * forwards messages it receives from authenticated sockets.
 *
 * @constructor
 *
 * @extends events.EventEmitter
 *
 * @param {Object} options the extended default options
 * @param {Function} readyCallback will be invoked once both the ws is ready
 */
module.exports = class UWSConnectionEndpoint extends ConnectionEndpoint {
  constructor (options) {
    super(options)

    // nexe needs *global.require* for __dynamic__ modules
    // but browserify and proxyquire can't handle *global.require*
    const req = global && global.require ? global.require : require

    this.uWS = req(fileUtils.lookupLibRequirePath('uWebSockets.js'))
    this.description = 'µWebSocket Connection Endpoint'
    this.onMessages = this.onMessages.bind(this)
    this.listenSocket = null;
  }

    /**
     * Initialize the uws endpoint, setup callbacks etc.
     *
     * @private
     * @returns {void}
     */
  createWebsocketServer () {
    this.connections = new Map();

    const server = new this.uWS.App({
      noDelay: this._getOption('noDelay'),
      perMessageDeflate: this._getOption('perMessageDeflate'),
      maxPayload: this._getOption('maxMessageSize')
    });

    server.ws('/deepstream', {
      /* Options */
      compression: 0,
      maxPayloadLength: 16 * 1024 * 1024,
      idleTimeout: 10,
      /* Handlers */
      open: (ws, request) => {
        const socketWrapper = this.createWebsocketWrapper(ws, request);
        this.connections.set(ws, socketWrapper);
        this._onConnection(this.createWebsocketWrapper(ws, request))
      },
      message: (ws, message, isBinary) => {
        this.connections.get(ws).onMessage(message);
      },
      drain: (ws) => {
      },
      close: (ws, code, message) => {
        this._onSocketClose(this.connections.get(ws));
      }
    });

    server.listen(this._getOption('port'), (token) => {
      /* Save the listen socket for later shut down */
      this.listenSocket = token;

      /* Did we even manage to listen? */
      if (token) {
        this._onReady();
      } else {
        console.log('Failed to listen to port ' + this._getOption('port'));
      }
    });

    return server
  }

  closeWebsocketServer () {
    this.uWS.us_listen_socket_close(this.listenSocket);
    setTimeout(() => this.emit('close'), 2000);
  }

  /**
   * Receives a connected socket, wraps it in a SocketWrapper, sends a connection ack to the user
   * and subscribes to authentication messages.
   * @param {Websocket} socket
   *
   * @param {WebSocket} external    uws native websocket
   *
   * @private
   * @returns {void}
   */
  createWebsocketWrapper (websocket, upgradeReq) {
    const handshakeData = {
      remoteAddress: websocket._socket.remoteAddress,
      headers: upgradeReq.headers,
      referer: upgradeReq.headers.referer
    }
    const socketWrapper = new SocketWrapper(
      websocket, handshakeData, this._logger, this._options, this
    )
    return socketWrapper
  }

  // eslint-disable-next-line
  onSocketWrapperClosed (socketWrapper) {
    socketWrapper.close()
  }
}