"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const needle = require("needle");
const constants_1 = require("../constants");
/**
 * This class represents a single request from deepstream to a http
 * endpoint for authentication data
 */
class HttpAuthenticationRequest {
    /**
     * Creates and issues the request and starts the timeout
     *
     * @param   {Object}   data           Map with authData and connectionData
     * @param   {Object}   settings       contains requestTimeout and permittedStatusCodes
     * @param   {Function} callback       Called with error, isAuthenticated, userData
     * @param   {Logger}   logger
     *
     * @constructor
     * @returns {void}
     */
    constructor(data, settings, logger, callback) {
        this.settings = settings;
        this.callback = callback;
        this.logger = logger;
        const options = {
            read_timeout: settings.requestTimeout,
            open_timeout: settings.requestTimeout,
            timeout: settings.requestTimeout,
            follow_max: 2,
            json: true
        };
        needle.post(settings.endpointUrl, data, options, this._onComplete.bind(this));
    }
    /**
     * Invoked for completed responses, whether succesful
     * or errors
     *
     * @param {Error} error HTTP Error
     * @param {http.Response} response
     */
    _onComplete(error, response) {
        if (error) {
            this.logger.warn(constants_1.EVENT.AUTH_ERROR, `http auth error: ${error}`);
            this.callback(false, null);
            this._destroy();
            return;
        }
        if (response.statusCode >= 500 && response.statusCode < 600) {
            this.logger.warn(constants_1.EVENT.AUTH_ERROR, `http auth server error: ${JSON.stringify(response.body)}`);
        }
        if (this.settings.permittedStatusCodes.indexOf(response.statusCode) === -1) {
            this.callback(false, response.body || null);
        }
        else if (response.body && typeof response.body === 'string') {
            this.callback(true, { username: response.body });
        }
        else {
            this.callback(true, response.body || null);
        }
        this._destroy();
    }
    /**
     * Destroys the class
     */
    _destroy() {
        // this.callback = null
        // this.logger = null
        // this.settings = null
    }
}
exports.default = HttpAuthenticationRequest;
//# sourceMappingURL=http-authentication-request.js.map