"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const C = require("../../src/constants");
const dependency_initialiser_1 = require("../../src/utils/dependency-initialiser");
const plugin_mock_1 = require("../test-mocks/plugin-mock");
const logger_mock_1 = require("../test-mocks/logger-mock");
const services = {
    logger: new logger_mock_1.default()
};
describe('dependency-initialiser', () => {
    let dependencyBInitialiser;
    const config = {
        pluginA: new plugin_mock_1.default({}, 'A'),
        pluginB: new plugin_mock_1.default({}, 'B'),
        pluginC: new plugin_mock_1.default({}, 'C'),
        brokenPlugin: {},
        dependencyInitialisationTimeout: 50
    };
    it('throws an error if dependency doesnt implement emitter or has isReady', () => {
        expect(() => {
            // tslint:disable-next-line:no-unused-expression
            new dependency_initialiser_1.default({}, config, services, {}, 'brokenPlugin');
        }).toThrow();
        expect(services.logger.lastLogEvent).toBe(C.EVENT.PLUGIN_INITIALIZATION_ERROR);
    });
    it('selects the correct plugin', () => {
        services.logger.lastLogEvent = null;
        dependencyBInitialiser = new dependency_initialiser_1.default({}, config, services, config.pluginB, 'pluginB');
        expect(dependencyBInitialiser.getDependency().description).toBe('B');
        expect(services.logger.lastLogEvent).toBe(null);
    });
    it('notifies when the plugin is ready', done => {
        const readySpy = jasmine.createSpy('ready');
        dependencyBInitialiser.on('ready', readySpy);
        config.pluginB.setReady();
        setTimeout(() => {
            expect(services.logger.lastLogEvent).toBe(C.EVENT.INFO);
            expect(readySpy.calls.count()).toBe(1);
            done();
        }, 5);
    });
    it('sets deepstream on the plugin if setDeepstream is present', () => {
        const dsMock = { is: 'deepstream' };
        const setDsSpy = config.pluginC.setDeepstream = jasmine.createSpy('setDeepstream');
        config.pluginC.isReady = true;
        // tslint:disable-next-line:no-unused-expression
        new dependency_initialiser_1.default(dsMock, config, services, config.pluginC, 'pluginC');
        expect(setDsSpy).toHaveBeenCalledWith(dsMock);
    });
    it('allows plugins to become ready after deepstream is set', () => {
        const dsMock = { is: 'deepstream' };
        config.pluginC.deepstream = null;
        config.pluginC.setDeepstream = deepstream => {
            config.pluginC.deepstream = deepstream;
            config.pluginC.setReady();
        };
        config.pluginC.isReady = false;
        // tslint:disable-next-line:no-unused-expression
        new dependency_initialiser_1.default(dsMock, config, services, config.pluginC, 'pluginC');
        expect(config.pluginC.deepstream).toBe(dsMock);
    });
});
describe('encounters timeouts and errors during dependency initialisations', () => {
    let dependencyInitialiser;
    const onReady = jasmine.createSpy('onReady');
    const originalConsoleLog = console.log;
    const config = {
        plugin: new plugin_mock_1.default('A'),
        dependencyInitialisationTimeout: 1
    };
    it('disables console.error', () => {
        Object.defineProperty(console, 'error', {
            value: services.logger.log
        });
    });
    it('creates a depdendency initialiser and doesnt initialise a plugin in time', done => {
        dependencyInitialiser = new dependency_initialiser_1.default({}, config, services, config.plugin, 'plugin');
        dependencyInitialiser.on('ready', onReady);
        expect(config.plugin.isReady).toBe(false);
        process.removeAllListeners('uncaughtException');
        process.once('uncaughtException', () => {
            expect(services.logger._log).toHaveBeenCalledWith(3, C.EVENT.PLUGIN_ERROR, 'plugin wasn\'t initialised in time');
            done();
        });
        expect(onReady).not.toHaveBeenCalled();
    });
    xit('creates another depdendency initialiser with a plugin error', next => {
        process.once('uncaughtException', () => {
            expect(onReady).not.toHaveBeenCalled();
            expect(services.logger._log).toHaveBeenCalledWith('Error while initialising dependency');
            expect(services.logger._log).toHaveBeenCalledWith('Error while initialising plugin: something went wrong');
            next();
        });
        dependencyInitialiser = new dependency_initialiser_1.default({}, config, services, config.plugin, 'plugin');
        dependencyInitialiser.on('ready', onReady);
        try {
            config.plugin.emit('error', 'something went wrong');
            next.fail();
        }
        catch (err) { }
    });
    it('enable console.error', () => {
        Object.defineProperty(console, 'error', {
            value: originalConsoleLog
        });
    });
});
//# sourceMappingURL=dependency-initialiserSpec.js.map