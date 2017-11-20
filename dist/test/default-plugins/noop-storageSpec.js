"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const noop_storage_1 = require("../../src/default-plugins/noop-storage");
describe('retuns null for all values', () => {
    let noopStorage;
    beforeAll(() => {
        noopStorage = new noop_storage_1.default();
    });
    it('has created the noop storage', () => {
        expect(noopStorage.isReady).toBe(true);
    });
    it('tries to retrieve a non-existing value', done => {
        const successCallback = jasmine.createSpy('success');
        noopStorage.get('firstname', successCallback);
        setTimeout(() => {
            expect(successCallback.calls.count()).toBe(1);
            expect(successCallback.calls.mostRecent().args).toEqual([null, null]);
            done();
        }, 1);
    });
    it('tries to delete a value', done => {
        const successCallback = jasmine.createSpy('success');
        noopStorage.delete('firstname', successCallback);
        setTimeout(() => {
            expect(successCallback.calls.count()).toBe(1);
            expect(successCallback.calls.mostRecent().args).toEqual([null]);
            done();
        }, 1);
    });
});
//# sourceMappingURL=noop-storageSpec.js.map