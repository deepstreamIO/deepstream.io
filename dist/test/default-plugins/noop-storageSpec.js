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
    it('tries to retrieve a non-existing value', () => {
        const successCallback = jasmine.createSpy('success');
        noopStorage.get('firstname', successCallback);
        expect(successCallback.calls.count()).toBe(1);
        expect(successCallback.calls.mostRecent().args).toEqual([null, null]);
    });
    it('tries to delete a value', () => {
        const successCallback = jasmine.createSpy('success');
        noopStorage.delete('firstname', successCallback);
        expect(successCallback.calls.count()).toBe(1);
        expect(successCallback.calls.mostRecent().args).toEqual([null]);
    });
});
//# sourceMappingURL=noop-storageSpec.js.map