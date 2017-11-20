"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http = require("http");
const https = require("https");
const url = require("url");
const events_1 = require("events");
const HTTPStatus = require("http-status");
const contentType = require("content-type");
const bodyParser = require("body-parser");
const httpShutdown = require("http-shutdown");
const constants_1 = require("../../constants");
function checkConfigOption(config, option, expectedType) {
    if ((expectedType && typeof config[option] !== expectedType) || config[option] === undefined) {
        throw new Error(`The HTTP plugin requires that the "${option}" config option is set`);
    }
}
class Server extends events_1.EventEmitter {
    constructor(config, logger) {
        super();
        this.config = config;
        this.logger = logger;
        this.isReady = false;
        this.methods = ['GET', 'POST', 'OPTIONS'];
        this.methodsStr = this.methods.join(', ');
        this.headers = ['X-Requested-With', 'X-HTTP-Method-Override', 'Content-Type', 'Accept'];
        this.headersLower = this.headers.map(header => header.toLowerCase());
        this.headersStr = this.headers.join(', ');
        this.jsonBodyParser = bodyParser.json({
            inflate: true,
            limit: '1mb' // TODO: make this configurable
        });
        checkConfigOption(config, 'port', 'number');
        checkConfigOption(config, 'host');
        checkConfigOption(config, 'enableAuthEndpoint', 'boolean');
        checkConfigOption(config, 'authPath', 'string');
        checkConfigOption(config, 'postPath', 'string');
        checkConfigOption(config, 'getPath', 'string');
        checkConfigOption(config, 'healthCheckPath', 'string');
        checkConfigOption(config, 'allowAllOrigins', 'boolean');
        // checkConfigOption(config, 'maxRequestPayload', 'number')
        if (config.allowAllOrigins === false) {
            checkConfigOption(config, 'origins', 'string');
            this.origins = config.origins;
        }
        this.authPathRegExp = new RegExp(`^${config.authPath}/?(.*)$`, 'i');
        this.postPathRegExp = new RegExp(`^${config.postPath}/?(.*)$`, 'i');
        this.getPathRegExp = new RegExp(`^${config.getPath}/?(.*)$`, 'i');
    }
    start() {
        const server = this._createHttpServer();
        this.httpServer = httpShutdown(server);
        this.httpServer.on('request', this._onRequest.bind(this));
        this.httpServer.once('listening', this._onReady.bind(this));
        this.httpServer.on('error', this._onError.bind(this));
        this.httpServer.listen(this.config.port, this.config.host);
    }
    stop(callback) {
        this.httpServer.shutdown(callback);
    }
    /**
     * Called when the server starts listening for requests.
     *
     * @private
     * @returns {void}
     */
    _onReady() {
        const serverAddress = this.httpServer.address();
        const address = serverAddress.address;
        const port = serverAddress.port;
        this.logger.info(constants_1.EVENT.INFO, `Listening for http connections on ${address}:${port}`);
        this.logger.info(constants_1.EVENT.INFO, `Listening for health checks on path ${this.config.healthCheckPath}`);
        this.emit('ready');
        this.isReady = true;
    }
    static _terminateResponse(response, code, message) {
        response.setHeader('Content-Type', 'text/plain; charset=utf-8');
        response.writeHead(code);
        if (message) {
            response.end(`${message}\r\n\r\n`);
        }
        else {
            response.end();
        }
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
        const key = this.sslKey;
        const cert = this.sslCert;
        const ca = this.sslCa;
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
    _onRequest(request, response) {
        if (!this.config.allowAllOrigins) {
            if (!this._verifyOrigin(request, response)) {
                return;
            }
        }
        else {
            response.setHeader('Access-Control-Allow-Origin', '*');
        }
        switch (request.method) {
            case 'POST':
                this._handlePost(request, response);
                break;
            case 'GET':
                this._handleGet(request, response);
                break;
            case 'OPTIONS':
                this._handleOptions(request, response);
                break;
            default:
                Server._terminateResponse(response, HTTPStatus.METHOD_NOT_ALLOWED, `Unsupported method. Supported methods: ${this.methodsStr}`);
        }
    }
    _verifyOrigin(request, response) {
        const requestOriginUrl = request.headers.origin || request.headers.referer;
        const requestHostUrl = request.headers.host;
        if (this.config.hostUrl && requestHostUrl !== this.config.hostUrl) {
            Server._terminateResponse(response, HTTPStatus.FORBIDDEN, 'Forbidden Host.');
            return false;
        }
        if (this.origins.indexOf(requestOriginUrl) === -1) {
            if (!requestOriginUrl) {
                Server._terminateResponse(response, HTTPStatus.FORBIDDEN, 'CORS is configured for this server. All requests must set a valid "Origin" header.');
            }
            else {
                Server._terminateResponse(response, HTTPStatus.FORBIDDEN, `Origin "${requestOriginUrl}" is forbidden.`);
            }
            return false;
        }
        // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Access-Control-Allow-Origin
        response.setHeader('Access-Control-Allow-Origin', requestOriginUrl);
        response.setHeader('Access-Control-Allow-Credentials', 'true');
        response.setHeader('Vary', 'Origin');
        return true;
    }
    _handlePost(request, response) {
        let parsedContentType;
        try {
            parsedContentType = contentType.parse(request);
        }
        catch (typeError) {
            parsedContentType = { type: null };
        }
        if (parsedContentType.type !== 'application/json') {
            Server._terminateResponse(response, HTTPStatus.UNSUPPORTED_MEDIA_TYPE, 'Invalid "Content-Type" header. Supported media types: "application/json"');
            return;
        }
        this.jsonBodyParser(request, response, err => {
            if (err) {
                Server._terminateResponse(response, HTTPStatus.BAD_REQUEST, `Failed to parse body of request: ${err.message}`);
                return;
            }
            const onResponse = Server._onHandlerResponse.bind(null, response);
            const metadata = { headers: request.headers, url: request.url };
            if (this.config.enableAuthEndpoint && this.authPathRegExp.test(request.url)) {
                this.emit('auth-message', request.body, metadata, onResponse);
            }
            else if (this.postPathRegExp.test(request.url)) {
                this.emit('post-message', request.body, metadata, onResponse);
            }
            else {
                Server._terminateResponse(response, HTTPStatus.NOT_FOUND, 'Endpoint not found.');
            }
        });
    }
    _handleGet(request, response) {
        const parsedUrl = url.parse(request.url, true);
        const onResponse = Server._onHandlerResponse.bind(null, response);
        if (parsedUrl.pathname === this.config.healthCheckPath) {
            response.setHeader('Content-Type', 'text/plain; charset=utf-8');
            response.writeHead(HTTPStatus.OK);
            response.end('OK\r\n\r\n');
        }
        else if (this.getPathRegExp.test(parsedUrl.pathname)) {
            this.emit('get-message', parsedUrl.query, request.headers, onResponse);
        }
        else {
            Server._terminateResponse(response, HTTPStatus.NOT_FOUND, 'Endpoint not found.');
        }
    }
    _handleOptions(request, response) {
        const requestMethod = request.headers['access-control-request-method'];
        if (!requestMethod) {
            Server._terminateResponse(response, HTTPStatus.BAD_REQUEST, 'Missing header "Access-Control-Request-Method".');
            return;
        }
        if (this.methods.indexOf(requestMethod) === -1) {
            Server._terminateResponse(response, HTTPStatus.FORBIDDEN, `Method ${requestMethod} is forbidden. Supported methods: ${this.methodsStr}`);
            return;
        }
        const requestHeadersRaw = request.headers['access-control-request-headers'];
        if (!requestHeadersRaw) {
            Server._terminateResponse(response, HTTPStatus.BAD_REQUEST, 'Missing header "Access-Control-Request-Headers".');
            return;
        }
        const requestHeaders = requestHeadersRaw.split(',');
        for (let i = 0; i < requestHeaders.length; i++) {
            if (this.headersLower.indexOf(requestHeaders[i].trim().toLowerCase()) === -1) {
                Server._terminateResponse(response, HTTPStatus.FORBIDDEN, `Header ${requestHeaders[i]} is forbidden. Supported headers: ${this.headersStr}`);
                return;
            }
        }
        response.setHeader('Access-Control-Allow-Methods', this.methodsStr);
        response.setHeader('Access-Control-Allow-Headers', this.headersStr);
        Server._terminateResponse(response, HTTPStatus.NO_CONTENT);
    }
    static _onHandlerResponse(response, err, data) {
        if (err) {
            const statusCode = err.statusCode || HTTPStatus.BAD_REQUEST;
            Server._terminateResponse(response, statusCode, err.message);
            return;
        }
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.writeHead(HTTPStatus.OK);
        response.end(`${JSON.stringify(data)}\r\n\r\n`);
    }
    /**
     * Generic callback for connection errors. This will most often be called
     * if the configured port number isn't available
     *
     * @param   {String} error
     *
     * @private
     * @returns {void}
     */
    _onError(error) {
        this.logger.error(constants_1.EVENT.CONNECTION_ERROR, error.toString());
    }
}
exports.default = Server;
//# sourceMappingURL=server.js.map