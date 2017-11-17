"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const local_cache_1 = require("../../src/default-plugins/local-cache");
describe('it saves values in memory', () => {
    let localCache;
    beforeAll(() => {
        localCache = new local_cache_1.default();
    });
    it('has created the local cache', () => {
        expect(localCache.isReady).toBe(true);
    });
    it('sets a value in the cache', () => {
        const successCallback = jasmine.createSpy('set success');
        localCache.set('firstname', 'Wolfram', successCallback);
        expect(successCallback.calls.count()).toBe(1);
        expect(successCallback.calls.mostRecent().args).toEqual([null]);
    });
    it('retrieves an existing value from the cache', () => {
        const successCallback = jasmine.createSpy('set success');
        localCache.get('firstname', successCallback);
        expect(successCallback.calls.count()).toBe(1);
        expect(successCallback.calls.mostRecent().args).toEqual([null, 'Wolfram']);
    });
    it('deletes a value from the cache', () => {
        const successCallback = jasmine.createSpy('set success');
        localCache.delete('firstname', successCallback);
        expect(successCallback.calls.count()).toBe(1);
        expect(successCallback.calls.mostRecent().args).toEqual([null]);
    });
    it('tries to retrieve a non-existing value from the cache', () => {
        const successCallback = jasmine.createSpy('set success');
        localCache.get('firstname', successCallback);
        expect(successCallback.calls.count()).toBe(1);
        expect(successCallback.calls.mostRecent().args).toEqual([null, null]);
    });
});
//# sourceMappingURL=local-cacheSpec.js.map