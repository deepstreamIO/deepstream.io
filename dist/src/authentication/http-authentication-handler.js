"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const http_authentication_request_1 = require("./http-authentication-request");
const events_1 = require("events");
const utils = require("../utils/utils");
/**
 * @extends {EventEmitter}
 */
class HttpAuthenticationHandler extends events_1.EventEmitter {
    /**
    * @param   {Object} settings
    * @param   {String} settings.endpointUrl http(s) endpoint that will receive post requests
    * @param   {Array}  settings.permittedStatusCodes an array of http status codes that qualify
    *                                                 as permitted
    * @param   {Number} settings.requestTimeout time in milliseconds before the request times out
    *                                           if no reply is received
    */
    constructor(settings, logger) {
        super();
        this.isReady = true;
        this.description = `http webhook to ${settings.endpointUrl}`;
        this.settings = settings;
        this.logger = logger;
        this._validateSettings();
    }
    /**
    * Main interface. Authenticates incoming connections
    *
    * @param   {Object}   connectionData
    * @param   {Object}   authData
    * @param   {Function} callback
    *
    * @public
    * @implements {PermissionHandler.isValidUser}
    * @returns {void}
    */
    isValidUser(connectionData, authData, callback) {
        // tslint:disable-next-line
        new http_authentication_request_1.default({ connectionData, authData }, this.settings, this.logger, callback);
    }
    /**
    * Validate the user provided settings
    */
    _validateSettings() {
        utils.validateMap(this.settings, true, {
            endpointUrl: 'url',
            permittedStatusCodes: 'array',
            requestTimeout: 'number',
        });
    }
}
exports.default = HttpAuthenticationHandler;
//# sourceMappingURL=http-authentication-handler.js.map