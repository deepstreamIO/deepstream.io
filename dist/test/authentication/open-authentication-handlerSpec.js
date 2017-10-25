"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const open_authentication_handler_1 = require("../../src/authentication/open-authentication-handler");
describe('open authentication handler', () => {
    let authenticationHandler;
    it('creates the handler', () => {
        authenticationHandler = new open_authentication_handler_1.default();
        expect(typeof authenticationHandler.isValidUser).toBe('function');
        expect(authenticationHandler.description).toBe('none');
    });
    it('permissions users without auth data', () => {
        const callback = jasmine.createSpy('callback');
        authenticationHandler.isValidUser(null, {}, callback);
        expect(callback).toHaveBeenCalledWith(true, { username: 'open' });
    });
    it('permissions users with a username', () => {
        const callback = jasmine.createSpy('callback');
        authenticationHandler.isValidUser(null, { username: 'Wolfram' }, callback);
        expect(callback).toHaveBeenCalledWith(true, { username: 'Wolfram' });
    });
});
//# sourceMappingURL=open-authentication-handlerSpec.js.map