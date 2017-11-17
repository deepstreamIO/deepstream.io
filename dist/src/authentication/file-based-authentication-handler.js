"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const crypto = require("crypto");
const events_1 = require("events");
const jsYamlLoader = require("../config/js-yaml-loader");
const utils = require("../utils/utils");
const STRING = 'string';
const STRING_CHARSET = 'base64';
/**
 * This authentication handler reads a list of users and their associated password (either
 * hashed or in cleartext ) from a json file. This can be useful to authenticate smaller amounts
 * of clients with static credentials, e.g. backend provider that write to publicly readable records
 */
class FileBasedAuthenticationHandler extends events_1.EventEmitter {
    /**
    * Creates the class, reads and validates the users.json file
    */
    constructor(settings) {
        super();
        this.isReady = false;
        this.description = `file using ${settings.path}`;
        this.validateSettings(settings);
        this.settings = settings;
        this.base64KeyLength = 4 * Math.ceil(this.settings.keyLength / 3);
        jsYamlLoader.readAndParseFile(settings.path, this.onFileLoad.bind(this));
    }
    /**
    * Main interface. Authenticates incoming connections
    */
    isValidUser(connectionData, authData, callback) {
        if (typeof authData.username !== STRING) {
            callback(false, { clientData: 'missing authentication parameter username' });
            return;
        }
        if (typeof authData.password !== STRING) {
            callback(false, { clientData: 'missing authentication parameter password' });
            return;
        }
        const userData = this.data[authData.username];
        if (!userData) {
            callback(false);
            return;
        }
        if (this.settings.hash) {
            this.isValid(authData.password, userData.password, authData.username, userData.serverData, userData.clientData, callback);
        }
        else if (authData.password === userData.password) {
            callback(true, {
                username: authData.username,
                serverData: typeof userData.serverData === 'undefined' ? null : userData.serverData,
                clientData: typeof userData.clientData === 'undefined' ? null : userData.clientData,
            });
        }
        else {
            callback(false);
        }
    }
    /**
    * Utility method for creating hashes including salts based on
    * the provided parameters
    */
    createHash(password, callback) {
        const salt = crypto.randomBytes(16).toString(STRING_CHARSET);
        crypto.pbkdf2(password, salt, this.settings.iterations, this.settings.keyLength, this.settings.hash, (err, hash) => {
            callback(err || null, hash.toString(STRING_CHARSET) + salt);
        });
    }
    /**
    * Callback for loaded JSON files. Makes sure that
    * no errors occured and every user has an associated password
    */
    onFileLoad(error, data) {
        if (error) {
            this.emit('error', `Error loading file ${this.settings.path}: ${error.toString()}`);
            return;
        }
        this.data = data;
        if (Object.keys(data).length === 0) {
            this.emit('error', 'no users present in user file');
            return;
        }
        for (const username in this.data) {
            if (typeof this.data[username].password !== STRING) {
                this.emit('error', `missing password for ${username}`);
            }
        }
        this.isReady = true;
        this.emit('ready');
    }
    /**
    * Called initially to validate the user provided settings
    */
    validateSettings(settings) {
        if (!settings.hash) {
            utils.validateMap(settings, true, {
                path: 'string',
            });
            return;
        }
        utils.validateMap(settings, true, {
            path: 'string',
            hash: 'string',
            iterations: 'number',
            keyLength: 'number',
        });
        if (crypto.getHashes().indexOf(settings.hash) === -1) {
            throw new Error(`Unknown Hash ${settings.hash}`);
        }
    }
    /**
    * Extracts hash and salt from a string and runs a hasing function
    * against it
    *
    * @param   {String}   password             the cleartext password the user provided
    * @param   {String}   passwordHashWithSalt the hash+salt combination from the users.json file
    * @param   {String}   username             as provided by user
    * @param   {Object}   serverData           arbitrary authentication data that will be passed on
    *                                          to the permission handler
    * @param   {Object}   clientData           arbitrary authentication data that will be passed on
    *                                          to the client
    * @param   {Function} callback             callback that will be invoked once hash is created
    *
    * @private
    * @returns {void}
    */
    isValid(password, passwordHashWithSalt, username, serverData, clientData, callback) {
        const expectedHash = passwordHashWithSalt.substr(0, this.base64KeyLength);
        const salt = passwordHashWithSalt.substr(this.base64KeyLength);
        crypto.pbkdf2(password, salt, this.settings.iterations, this.settings.keyLength, this.settings.hash, this.compareHashResult.bind(this, expectedHash, username, serverData, clientData, callback));
    }
    /**
    * Callback once hashing is completed
    *
    * @param   {String}   expectedHash     has as retrieved from users.json
    * @param   {Object}   serverData       arbitrary authentication data that will be passed on to the
    *                                      permission handler
    * @param   {Object}   clientData       arbitrary authentication data that will be passed on to the
    *                                      client
    * @param   {Function} callback         callback from isValidUser
    * @param   {Error}    error            error that occured during hashing
    * @param   {Buffer}   actualHashBuffer the buffer containing the bytes for the new hash
    */
    compareHashResult(expectedHash, username, serverData, clientData, callback, error, actualHashBuffer) {
        if (expectedHash === actualHashBuffer.toString(STRING_CHARSET)) {
            // todo log error
            callback(true, {
                username,
                serverData: serverData || null,
                clientData: clientData || null,
            });
        }
        else {
            callback(false);
        }
    }
}
exports.default = FileBasedAuthenticationHandler;
//# sourceMappingURL=file-based-authentication-handler.js.map