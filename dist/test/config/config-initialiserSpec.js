"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path = require("path");
const defaultConfig = require('../../src/default-options');
const configInitialiser = require('../../src/config/config-initialiser');
describe('config-initialiser', () => {
    beforeAll(() => {
        global.deepstreamConfDir = null;
        global.deepstreamLibDir = null;
        global.deepstreamCLI = null;
    });
    describe('plugins are initialised as per configuration', () => {
        it('loads plugins from a relative path', () => {
            const config = defaultConfig.get();
            config.plugins = {
                cache: {
                    path: './dist/test/test-mocks/plugin-mock',
                    options: { some: 'options' }
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.cache.description).toBe('mock-plugin');
            expect(result.services.cache.options).toEqual({ some: 'options' });
        });
        it('loads plugins via module names', () => {
            const config = defaultConfig.get();
            config.plugins = {
                cache: {
                    path: 'n0p3',
                    options: {}
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.toString()).toBe('[object Object]');
        });
        it('loads plugins from a relative path and lib dir', () => {
            global.deepstreamLibDir = './dist/test/test-mocks';
            const config = defaultConfig.get();
            config.plugins = {
                cache: {
                    path: './plugin-mock',
                    options: { some: 'options' }
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.cache.description).toBe('mock-plugin');
            expect(result.services.cache.options).toEqual({ some: 'options' });
        });
    });
    describe('ssl files are loaded if provided', () => {
        it('fails with incorrect path passed in', () => {
            ['sslKey', 'sslCert', 'sslCa'].forEach(key => {
                const config = defaultConfig.get();
                config[key] = './does-not-exist';
                expect(() => {
                    configInitialiser.initialise(config);
                }).toThrowError();
            });
        });
        it('loads sslFiles from a relative path and a config prefix', () => {
            global.deepstreamConfDir = './test/test-configs';
            const config = defaultConfig.get();
            config.sslKey = './sslKey.pem';
            const result = configInitialiser.initialise(config);
            expect(result.config.sslKey).toBe('I\'m a key');
        });
    });
    describe('translates shortcodes into paths', () => {
        it('translates cache', () => {
            global.deepstreamLibDir = '/foobar';
            const config = defaultConfig.get();
            let errored = false;
            config.plugins = {
                cache: {
                    name: 'blablub'
                }
            };
            try {
                configInitialiser.initialise(config);
            }
            catch (e) {
                errored = true;
                expect(e.toString()).toContain(path.join('/foobar', 'deepstream.io-cache-blablub'));
            }
            expect(errored).toBe(true);
        });
    });
    describe('creates the right authentication handler', () => {
        beforeAll(() => {
            global.deepstreamLibDir = './dist/test/test-plugins';
        });
        it('works for authtype: none', () => {
            const config = defaultConfig.get();
            config.auth = {
                type: 'none'
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.authenticationHandler.description).toBe('none');
        });
        it('works for authtype: user', () => {
            global.deepstreamConfDir = './test/test-configs';
            const config = defaultConfig.get();
            config.auth = {
                type: 'file',
                options: {
                    path: './users.json'
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.authenticationHandler.description).toContain('file using');
            expect(result.services.authenticationHandler.description).toContain(path.resolve('test/test-configs/users.json'));
        });
        it('works for authtype: http', () => {
            const config = defaultConfig.get();
            config.auth = {
                type: 'http',
                options: {
                    endpointUrl: 'http://some-url.com',
                    permittedStatusCodes: [200],
                    requestTimeout: 2000
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.authenticationHandler.description).toBe('http webhook to http://some-url.com');
        });
        it('fails for missing auth sections', () => {
            const config = defaultConfig.get();
            delete config.auth;
            expect(() => {
                configInitialiser.initialise(config);
            }).toThrowError('No authentication type specified');
        });
        it('allows passing a custom authentication handler', () => {
            const config = defaultConfig.get();
            config.auth = {
                path: '../test-mocks/authentication-handler-mock',
                options: {
                    hello: 'there'
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.authenticationHandler.isReady).toBe(true);
            expect(result.services.authenticationHandler.options).toEqual({ hello: 'there' });
        });
        it('tries to find a custom authentication handler from name', () => {
            const config = defaultConfig.get();
            config.auth = {
                name: 'my-custom-auth-handler',
            };
            expect(() => {
                configInitialiser.initialise(config);
            }).toThrowError(/Cannot find module/);
        });
        it('fails for unknown auth types', () => {
            const config = defaultConfig.get();
            config.auth = {
                type: 'bla',
                options: {}
            };
            expect(() => {
                configInitialiser.initialise(config);
            }).toThrowError('Unknown authentication type bla');
        });
        it('overrides with type "none" when disableAuth is set', () => {
            global.deepstreamCLI = { disableAuth: true };
            const config = defaultConfig.get();
            config.auth = {
                type: 'http',
                options: {}
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.authenticationHandler.description).toBe('none');
            delete global.deepstreamCLI;
        });
    });
    describe('creates the permissionHandler', () => {
        it('creates the config permission handler', () => {
            global.deepstreamConfDir = './dist/test/test-configs';
            const config = defaultConfig.get();
            config.permission = {
                type: 'config',
                options: {
                    path: './basic-permission-config.json'
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.permissionHandler.description).toContain('valve permissions loaded from');
            expect(result.services.permissionHandler.description).toContain(path.resolve('./dist/test/test-configs/basic-permission-config.json'));
        });
        it('fails for invalid permission types', () => {
            const config = defaultConfig.get();
            config.permission = {
                type: 'does-not-exist',
                options: {
                    path: './dist/test/test-configs/basic-permission-config.json'
                }
            };
            expect(() => {
                configInitialiser.initialise(config);
            }).toThrowError('Unknown permission type does-not-exist');
        });
        it('allows passing a custom permission handler', () => {
            const config = defaultConfig.get();
            config.permission = {
                path: '../test-mocks/permission-handler-mock',
                options: {
                    hello: 'there'
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.permissionHandler.isReady).toBe(true);
            expect(result.services.permissionHandler.options).toEqual({ hello: 'there' });
        });
        it('tries to find a custom authentication handler from name', () => {
            const config = defaultConfig.get();
            config.auth = {
                name: 'my-custom-perm-handler',
            };
            expect(() => {
                configInitialiser.initialise(config);
            }).toThrowError(/Cannot find module/);
        });
        it('fails for missing permission configs', () => {
            const config = defaultConfig.get();
            delete config.permission;
            expect(() => {
                configInitialiser.initialise(config);
            }).toThrowError('No permission type specified');
        });
        it('overrides with type "none" when disablePermissions is set', () => {
            global.deepstreamCLI = { disablePermissions: true };
            const config = defaultConfig.get();
            config.permission = {
                type: 'config',
                options: {}
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.permissionHandler.description).toBe('none');
            delete global.deepstreamCLI;
        });
    });
    describe('supports custom loggers', () => {
        it('load the default logger with options', () => {
            global.deepstreamLibDir = null;
            const config = defaultConfig.get();
            config.logger = {
                type: 'default',
                options: {
                    logLevel: 2
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.logger.options).toEqual({ logLevel: 2 });
        });
        it('load a custom logger', () => {
            global.deepstreamLibDir = null;
            const config = defaultConfig.get();
            config.logger = {
                path: './dist/test/test-helper/custom-logger',
                options: {
                    a: 1
                }
            };
            const result = configInitialiser.initialise(config);
            expect(result.services.logger.options).toEqual({ a: 1 });
        });
        it('throw an error for a unsupported logger type', next => {
            const config = defaultConfig.get();
            config.logger = {
                norNameNorPath: 'foo',
            };
            try {
                configInitialiser.initialise(config);
                next.fail('should fail');
            }
            catch (err) {
                expect(err.toString()).toContain('Neither name nor path property found');
                next();
            }
        });
    });
});
//# sourceMappingURL=config-initialiserSpec.js.map