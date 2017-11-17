'use strict';
const PermissionHandler = require('../../src/permission/open-permission-handler').default;
describe('open permission handler', () => {
    let permissionHandler;
    it('allows any action', done => {
        permissionHandler = new PermissionHandler();
        const message = {
            topic: 'This doesnt matter',
            action: 'Since it allows anything',
            data: ['anything']
        };
        permissionHandler.canPerformAction('someone', message, (error, success) => {
            expect(error).toBeNull();
            expect(success).toBe(true);
            done();
        }, {});
    });
});
//# sourceMappingURL=open-permission-handlerSpec.js.map