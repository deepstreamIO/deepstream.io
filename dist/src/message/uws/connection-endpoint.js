"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../../constants");
const messageBuilder = require("../../../protocol/text/src/message-builder");
const socket_wrapper_factory_1 = require("./socket-wrapper-factory");
const events_1 = require("events");
const https = require("https");
const http = require("http");
const uws = require("uws");
const OPEN = 'OPEN';
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
class UWSConnectionEndpoint extends events_1.EventEmitter {
    constructor(options, services) {
        super();
        this.options = options;
        this.services = services;
        this.isReady = false;
        this.description = 'µWebSocket Connection Endpoint';
        this.initialised = false;
        this.authenticatedSockets = new Set();
        this._flushSockets = this._flushSockets.bind(this);
    }
    /**
     * Called on initialization with a reference to the instantiating deepstream server.
     */
    setDeepstream(deepstream) {
        this.dsOptions = deepstream.config;
        this.logger = deepstream.services.logger;
        this.authenticationHandler = deepstream.services.authenticationHandler;
    }
    /**
     * Initialise and setup the http and WebSocket servers.
     *
     * @throws Will throw if called before `setDeepstream()`.
     */
    init() {
        if (!this.dsOptions) {
            throw new Error('setDeepstream must be called before init()');
        }
        if (this.initialised) {
            throw new Error('init() must only be called once');
        }
        this.initialised = true;
        this.healthCheckPath = this._getOption('healthCheckPath');
        this.maxAuthAttempts = this._getOption('maxAuthAttempts');
        this.logInvalidAuthData = this._getOption('logInvalidAuthData');
        this.urlPath = this._getOption('urlPath');
        this.unauthenticatedClientTimeout = this._getOption('unauthenticatedClientTimeout');
        this._uwsInit();
        this.server = this._createHttpServer();
        this.server.on('request', this._handleHealthCheck.bind(this));
        this.server.once('listening', this._onReady.bind(this));
        this.server.on('error', this._onError.bind(this));
        this.server.on('upgrade', this._onUpgradeRequest.bind(this));
        const port = this._getOption('port');
        const host = this._getOption('host');
        this.server.listen(port, host);
    }
    /**
     * Called from a socketWrapper. This method tells the connection endpoint
     * to flush the socket after a certain amount of time, used to low priority
     * messages
     */
    scheduleFlush(socketWrapper) {
        this.scheduledSocketWrapperWrites.add(socketWrapper);
        if (!this.flushTimeout) {
            this.flushTimeout = setTimeout(this._flushSockets, this.options.outgoingBufferTimeout);
        }
    }
    /**
     * Called when the flushTimeout occurs in order to send  all pending socket acks
     */
    _flushSockets() {
        for (const socketWrapper of this.scheduledSocketWrapperWrites) {
            socketWrapper.flush();
        }
        this.scheduledSocketWrapperWrites.clear();
        this.flushTimeout = null;
    }
    /**
     * Get a parameter from the root of the deepstream options if present, otherwise get it from the
     * plugin config. If neither is present, default to the optionally provided default.
     */
    _getOption(option) {
        const value = this.dsOptions[option];
        if ((value === null || value === undefined) && (this.options[option] !== undefined)) {
            return this.options[option];
        }
        return value;
    }
    /**
     * Initialize the uws endpoint, setup callbacks etc.
     */
    _uwsInit() {
        const maxMessageSize = this._getOption('maxMessageSize');
        const perMessageDeflate = this._getOption('perMessageDeflate');
        this.serverGroup = uws.native.server.group.create(perMessageDeflate, maxMessageSize);
        this.noDelay = this._getOption('noDelay');
        uws.native.server.group.onDisconnection(this.serverGroup, (external, code, message, socketWrapper) => {
            if (socketWrapper) {
                socketWrapper.close();
            }
        });
        uws.native.server.group.onMessage(this.serverGroup, (message, socketWrapper) => {
            const parsedMessages = socketWrapper.parseMessage(message);
            if (parsedMessages.length > 0) {
                socketWrapper.onMessage(parsedMessages);
            }
        });
        uws.native.server.group.onPing(this.serverGroup, () => { });
        uws.native.server.group.onPong(this.serverGroup, () => { });
        uws.native.server.group.onConnection(this.serverGroup, this._onConnection.bind(this));
        // TODO: This will become an issue when distinguishing
        // between different protocols
        uws.native.server.group.startAutoPing(this.serverGroup, this._getOption('heartbeatInterval'), messageBuilder.getMessage({
            topic: constants_1.TOPIC.CONNECTION,
            action: constants_1.CONNECTION_ACTIONS.PING
        }, false));
    }
    /**
     * Called for the ready event of the ws server.
     */
    _onReady() {
        const serverAddress = this.server.address();
        const address = serverAddress.address;
        const port = serverAddress.port;
        const wsMsg = `Listening for websocket connections on ${address}:${port}${this.urlPath}`;
        this.logger.info(constants_1.EVENT.INFO, wsMsg);
        const hcMsg = `Listening for health checks on path ${this.healthCheckPath} `;
        this.logger.info(constants_1.EVENT.INFO, hcMsg);
        this.emit('ready');
        this.isReady = true;
    }
    /**
     * Called for every message that's received
     * from an authenticated socket
     *
     * This method will be overridden by an external class and is used instead
     * of an event emitter to improve the performance of the messaging pipeline
     */
    onMessages(socketWrapper, messages) {
    }
    /**
     * Creates an HTTP or HTTPS server for ws to attach itself to,
     * depending on the options the client configured
     *
     * @private
     * @returns {http.HttpServer | http.HttpsServer}
     */
    _createHttpServer() {
        const httpsParams = this._getHttpsParams();
        if (httpsParams) {
            return https.createServer(httpsParams);
        }
        return http.createServer();
    }
    /**
    * Returns sslKey, sslCert and sslCa options from the config.
    *
    * @throws Will throw an error if one of sslKey or sslCert are not specified
    *
    * @private
    * @returns {null|Object} {
    *   {String}           key   ssl key
    *   {String}           cert  ssl certificate
    *   {String|undefined} ca    ssl certificate authority (if it's present in options)
    * }
    */
    _getHttpsParams() {
        const key = this._getOption('sslKey');
        const cert = this._getOption('sslCert');
        const ca = this._getOption('sslCa');
        if (key || cert) {
            if (!key) {
                throw new Error('Must also include sslKey in order to use HTTPS');
            }
            if (!cert) {
                throw new Error('Must also include sslCert in order to use HTTPS');
            }
            return { key, cert, ca };
        }
        return null;
    }
    /**
     * Responds to http health checks.
     * Responds with 200(OK) if deepstream is alive.
     *
     * @private
     * @returns {void}
     */
    _handleHealthCheck(req, res) {
        if (req.method === 'GET' && req.url === this.healthCheckPath) {
            res.writeHead(200);
            res.end();
        }
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
    _onConnection(external) {
        const address = uws.native.getAddress(external);
        const handshakeData = {
            remoteAddress: address[1],
            headers: this.upgradeRequest.headers,
            referer: this.upgradeRequest.headers.referer
        };
        this.upgradeRequest = null;
        const socketWrapper = socket_wrapper_factory_1.createSocketWrapper(external, handshakeData, this.logger, this.options, this);
        uws.native.setUserData(external, socketWrapper);
        this.logger.info(constants_1.EVENT.INCOMING_CONNECTION, `from ${handshakeData.referer} (${handshakeData.remoteAddress})`);
        let disconnectTimer;
        if (this.unauthenticatedClientTimeout !== null && this.unauthenticatedClientTimeout !== false) {
            disconnectTimer = setTimeout(this._processConnectionTimeout.bind(this, socketWrapper), this.unauthenticatedClientTimeout);
            socketWrapper.once('close', clearTimeout.bind(null, disconnectTimer));
        }
        socketWrapper.authCallback = this._authenticateConnection.bind(this, socketWrapper, disconnectTimer);
        socketWrapper.sendMessage({
            topic: constants_1.TOPIC.CONNECTION,
            action: constants_1.CONNECTION_ACTIONS.CHALLENGE
        }, false);
        socketWrapper.onMessage = this._processConnectionMessage.bind(this, socketWrapper);
    }
    /**
     * Always challenges the client that connects. This will be opened up later to allow users
     * to put in their own challenge authentication.
     */
    _processConnectionMessage(socketWrapper, parsedMessages) {
        const msg = parsedMessages[0];
        if (msg.parseError) {
            this.logger.warn(constants_1.PARSER_ACTIONS[constants_1.PARSER_ACTIONS.MESSAGE_PARSE_ERROR], `error parsing connection message ${msg.raw}`);
            socketWrapper.sendError({
                topic: constants_1.TOPIC.CONNECTION
            }, constants_1.PARSER_ACTIONS.MESSAGE_PARSE_ERROR, msg.raw);
            socketWrapper.destroy();
            return;
        }
        if (msg.topic !== constants_1.TOPIC.CONNECTION) {
            this.logger.warn(constants_1.PARSER_ACTIONS[constants_1.PARSER_ACTIONS.INVALID_MESSAGE], `invalid connection message ${msg.raw}`);
            socketWrapper.sendError({
                topic: constants_1.TOPIC.CONNECTION,
            }, constants_1.PARSER_ACTIONS.INVALID_MESSAGE, msg.raw);
            return;
        }
        if (msg.action === constants_1.CONNECTION_ACTIONS.CHALLENGE_RESPONSE) {
            socketWrapper.onMessage = socketWrapper.authCallback;
            socketWrapper.sendMessage({
                topic: constants_1.TOPIC.CONNECTION,
                action: constants_1.CONNECTION_ACTIONS.ACCEPT
            });
            return;
        }
        this.logger.error(constants_1.PARSER_ACTIONS[constants_1.PARSER_ACTIONS.UNKNOWN_ACTION], msg.action);
    }
    /**
     * Callback for the first message that's received from the socket.
     * This is expected to be an auth-message. This method makes sure that's
     * the case and - if so - forwards it to the permission handler for authentication
     */
    _authenticateConnection(socketWrapper, disconnectTimeout, parsedMessages) {
        const msg = parsedMessages[0];
        let errorMsg;
        if (msg.parseError) {
            this.logger.warn(constants_1.PARSER_ACTIONS[constants_1.PARSER_ACTIONS.MESSAGE_PARSE_ERROR], `error parsing auth message ${msg.raw}`);
            socketWrapper.sendError({
                topic: constants_1.TOPIC.AUTH
            }, constants_1.PARSER_ACTIONS.MESSAGE_PARSE_ERROR, msg.raw);
            socketWrapper.destroy();
            return;
        }
        if (msg.topic !== constants_1.TOPIC.AUTH) {
            this.logger.warn(constants_1.PARSER_ACTIONS[constants_1.PARSER_ACTIONS.INVALID_MESSAGE], `invalid auth message ${msg.raw}`);
            socketWrapper.sendError({
                topic: constants_1.TOPIC.AUTH,
            }, constants_1.PARSER_ACTIONS.INVALID_MESSAGE, msg.raw);
            return;
        }
        /**
         * Log the authentication attempt
         */
        const logMsg = socketWrapper.getHandshakeData().remoteAddress;
        this.logger.debug(constants_1.AUTH_ACTIONS[constants_1.AUTH_ACTIONS.REQUEST], logMsg);
        /**
         * Ensure the message is a valid authentication message
         */
        if (msg.action !== constants_1.AUTH_ACTIONS.REQUEST) {
            errorMsg = this.logInvalidAuthData === true ? msg.data : '';
            this._sendInvalidAuthMsg(socketWrapper, errorMsg);
            return;
        }
        /**
         * Ensure the authentication data is valid JSON
         */
        const result = socketWrapper.parseData(msg);
        if (result instanceof Error || !msg.parsedData || typeof msg.parsedData !== 'object') {
            errorMsg = 'Error parsing auth message';
            if (this.logInvalidAuthData === true) {
                errorMsg += ` "${msg.data}": ${result.toString()}`;
            }
            this._sendInvalidAuthMsg(socketWrapper, errorMsg);
            return;
        }
        /**
         * Forward for authentication
         */
        this.authenticationHandler.isValidUser(socketWrapper.getHandshakeData(), msg.parsedData, this._processAuthResult.bind(this, msg.parsedData, socketWrapper, disconnectTimeout));
    }
    /**
     * Will be called for syntactically incorrect auth messages. Logs
     * the message, sends an error to the client and closes the socket
     */
    _sendInvalidAuthMsg(socketWrapper, msg) {
        this.logger.warn(constants_1.AUTH_ACTIONS[constants_1.AUTH_ACTIONS.INVALID_MESSAGE_DATA], this.logInvalidAuthData ? msg : '');
        socketWrapper.sendError({
            topic: constants_1.TOPIC.AUTH
        }, constants_1.AUTH_ACTIONS.INVALID_MESSAGE_DATA);
        socketWrapper.destroy();
    }
    /**
     * Callback for succesfully validated sockets. Removes
     * all authentication specific logic and registeres the
     * socket with the authenticated sockets
     */
    _registerAuthenticatedSocket(socketWrapper, userData) {
        delete socketWrapper.authCallback;
        socketWrapper.once('close', this._onSocketClose.bind(this, socketWrapper));
        socketWrapper.onMessage = (parsedMessages) => {
            this.onMessages(socketWrapper, parsedMessages);
        };
        this._appendDataToSocketWrapper(socketWrapper, userData);
        socketWrapper.sendMessage({
            topic: constants_1.TOPIC.AUTH,
            action: constants_1.AUTH_ACTIONS.AUTH_SUCCESSFUL,
            parsedData: userData.clientData
        });
        if (socketWrapper.user !== OPEN) {
            this.emit('client-connected', socketWrapper);
        }
        this.authenticatedSockets.add(socketWrapper);
        this.logger.info(constants_1.AUTH_ACTIONS[constants_1.AUTH_ACTIONS.AUTH_SUCCESSFUL], socketWrapper.user);
    }
    /**
     * Append connection data to the socket wrapper
     */
    _appendDataToSocketWrapper(socketWrapper, userData) {
        socketWrapper.user = userData.username || OPEN;
        socketWrapper.authData = userData.serverData || null;
    }
    /**
     * Callback for invalid credentials. Will notify the client
     * of the invalid auth attempt. If the number of invalid attempts
     * exceed the threshold specified in options.maxAuthAttempts
     * the client will be notified and the socket destroyed.
     */
    _processInvalidAuth(clientData, authData, socketWrapper) {
        let logMsg = 'invalid authentication data';
        if (this.logInvalidAuthData === true) {
            logMsg += `: ${JSON.stringify(authData)}`;
        }
        this.logger.info(constants_1.AUTH_ACTIONS[constants_1.AUTH_ACTIONS.AUTH_UNSUCCESSFUL], logMsg);
        socketWrapper.sendError({
            topic: constants_1.TOPIC.AUTH,
            parsedData: clientData
        }, constants_1.AUTH_ACTIONS.AUTH_UNSUCCESSFUL);
        socketWrapper.authAttempts++;
        if (socketWrapper.authAttempts >= this.maxAuthAttempts) {
            this.logger.info(constants_1.AUTH_ACTIONS[constants_1.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS], 'too many authentication attempts');
            socketWrapper.sendError({
                topic: constants_1.TOPIC.AUTH
            }, constants_1.AUTH_ACTIONS.TOO_MANY_AUTH_ATTEMPTS);
            socketWrapper.destroy();
        }
    }
    /**
     * Callback for connections that have not authenticated succesfully within
     * the expected timeframe
     */
    _processConnectionTimeout(socketWrapper) {
        const log = 'connection has not authenticated successfully in the expected time';
        this.logger.info(constants_1.CONNECTION_ACTIONS[constants_1.CONNECTION_ACTIONS.CONNECTION_AUTHENTICATION_TIMEOUT], log);
        socketWrapper.sendError({
            topic: constants_1.TOPIC.CONNECTION
        }, constants_1.CONNECTION_ACTIONS.CONNECTION_AUTHENTICATION_TIMEOUT);
        socketWrapper.destroy();
    }
    /**
     * Callback for the results returned by the permissionHandler
     */
    _processAuthResult(authData, socketWrapper, disconnectTimeout, isAllowed, userData) {
        userData = userData || {};
        clearTimeout(disconnectTimeout);
        if (isAllowed === true) {
            this._registerAuthenticatedSocket(socketWrapper, userData);
        }
        else {
            this._processInvalidAuth(userData.clientData, authData, socketWrapper); // todo
        }
    }
    /**
     * Generic callback for connection errors. This will most often be called
     * if the configured port number isn't available
     */
    _onError(error) {
        this.logger.error(constants_1.EVENT.CONNECTION_ERROR, error.toString());
    }
    /**
    * Notifies the (optional) onClientDisconnect method of the permissionHandler
    * that the specified client has disconnected
    */
    _onSocketClose(socketWrapper) {
        if (this.authenticationHandler.onClientDisconnect) {
            this.authenticationHandler.onClientDisconnect(socketWrapper.user);
        }
        if (socketWrapper.user !== OPEN) {
            this.emit('client-disconnected', socketWrapper);
        }
        // uws.native.clearUserData(socketWrapper._external)
        this.authenticatedSockets.delete(socketWrapper);
    }
    /**
     * HTTP upgrade request listener
     */
    _onUpgradeRequest(request, socket) {
        const requestPath = request.url.split('?')[0].split('#')[0];
        if (!this.urlPath || this.urlPath === requestPath) {
            this._handleUpgrade(request, socket);
        }
        UWSConnectionEndpoint._terminateSocket(socket, 400, 'URL not supported');
    }
    /**
     * Terminate an HTTP socket with some error code and error message
     */
    static _terminateSocket(socket, code, name) {
        socket.end(`HTTP/1.1 ${code}  ${name}\r\n\r\n`);
    }
    /**
     * Process websocket upgrade
     */
    _handleUpgrade(request, socket) {
        const secKey = request.headers['sec-websocket-key'];
        const socketHandle = socket.ssl ? socket._parent._handle : socket._handle;
        const sslState = socket.ssl ? socket.ssl._external : null;
        if (secKey && secKey.length === 24) {
            socket.setNoDelay(this.noDelay);
            const ticket = uws.native.transfer(socketHandle.fd === -1 ? socketHandle : socketHandle.fd, sslState);
            socket.on('close', () => {
                if (this.serverGroup) {
                    this.upgradeRequest = request;
                    uws.native.upgrade(this.serverGroup, ticket, secKey, request.headers['sec-websocket-extensions'], request.headers['sec-websocket-protocol']);
                }
            });
        }
        socket.destroy();
    }
    /**
     * Closes the ws server connection. The ConnectionEndpoint
     * will emit a close event once succesfully shut down
     */
    close() {
        this.server.removeAllListeners('request');
        this.server.removeAllListeners('upgrade');
        if (this.serverGroup) {
            uws.native.server.group.close(this.serverGroup);
        }
        this.serverGroup = null;
        this.server.close(() => {
            this.emit('close');
        });
    }
}
exports.default = UWSConnectionEndpoint;
//# sourceMappingURL=connection-endpoint.js.map