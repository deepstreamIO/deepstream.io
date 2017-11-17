"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class AuthenticationHandlerMock {
    constructor(options) {
        this.options = options;
        this.isReady = true;
        this.reset();
    }
    reset() {
        this.nextUserIsAnonymous = false;
        this.nextUserValidationResult = true;
        this.lastUserValidationQueryArgs = null;
        this.sendNextValidAuthWithData = false;
        this.onClientDisconnectCalledWith = null;
    }
    isValidUser(handshakeData, authData, callback) {
        this.lastUserValidationQueryArgs = arguments;
        if (this.nextUserValidationResult === true) {
            if (this.sendNextValidAuthWithData === true) {
                callback(true, {
                    username: 'test-user',
                    clientData: 'test-data'
                });
            }
            else if (this.nextUserIsAnonymous) {
                callback(true, {});
            }
            else {
                callback(true, { username: 'test-user' });
            }
        }
        else {
            callback(false, { clientData: 'Invalid User' });
        }
    }
    onClientDisconnect(username) {
        this.onClientDisconnectCalledWith = username;
    }
}
exports.default = AuthenticationHandlerMock;
//# sourceMappingURL=authentication-handler-mock.js.map