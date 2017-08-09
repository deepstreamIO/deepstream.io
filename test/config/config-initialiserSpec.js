/* global jasmine, spyOn, describe, it, expect, beforeAll, beforeEach, afterEach */
'use strict'

const defaultConfig = require('../../src/default-options')
const configInitialiser = require('../../src/config/config-initialiser')
const path = require('path')

describe('config-initialiser', () => {
  beforeAll(() => {
    global.deepstreamConfDir = null
    global.deepstreamLibDir = null
    global.deepstreamCLI = null
  })

  describe('plugins are initialised as per configuration', () => {
    it('loads plugins from a relative path', () => {
      const config = defaultConfig.get()
      config.plugins = {
        cache: {
          path: './test/test-plugins/plugin-a',
          options: { some: 'options' }
        }
      }
      configInitialiser.initialise(config)
      expect(config.cache.type).toBe('pluginA')
      expect(config.cache.options).toEqual({ some: 'options' })
    })

    it('loads plugins via module names', () => {
      const config = defaultConfig.get()
      config.plugins = {
        cache: {
          path: 'n0p3',
          options: {}
        }
      }

      configInitialiser.initialise(config)
      expect(config.cache.toString()).toBe('[object Object]')
    })

    it('loads plugins from a relative path and lib dir', () => {
      global.deepstreamLibDir = './test/test-plugins'

      const config = defaultConfig.get()
      config.plugins = {
        cache: {
          path: './plugin-a',
          options: { some: 'options' }
        }
      }
      configInitialiser.initialise(config)
      expect(config.cache.type).toBe('pluginA')
      expect(config.cache.options).toEqual({ some: 'options' })
    })
  })

  describe('ssl files are loaded if provided', () => {
    it('fails with incorrect path passed in', () => {
      ['sslKey', 'sslCert', 'sslCa'].forEach((key) => {
        const config = defaultConfig.get()
        config[key] = './does-not-exist'
        expect(() => {
          configInitialiser.initialise(config)
        }).toThrowError()
      })
    })

    it('loads sslFiles from a relative path and a config prefix', () => {
      global.deepstreamConfDir = './test/test-configs'

      const config = defaultConfig.get()
      config.sslKey = './sslKey.pem'
      configInitialiser.initialise(config)
      expect(config.sslKey).toBe('I\'m a key')
    })
  })

  describe('translates shortcodes into paths', () => {
    it('translates cache', () => {
      global.deepstreamLibDir = '/foobar'
      const config = defaultConfig.get()
      let errored = false
      config.plugins = {
        cache: {
          name: 'blablub'
        }
      }
      try {
        configInitialiser.initialise(config)
      } catch (e) {
        errored = true
        expect(e.toString()).toContain(path.join('/foobar', 'deepstream.io-cache-blablub'))
      }

      expect(errored).toBe(true)
    })
  })

  describe('creates the right authentication handler', () => {
    beforeAll(() => {
      global.deepstreamLibDir = './test/test-plugins'
    })

    it('works for authtype: none', () => {
      const config = defaultConfig.get()

      config.auth = {
        type: 'none'
      }
      configInitialiser.initialise(config)
      expect(config.authenticationHandler.type).toBe('none')
    })

    it('works for authtype: user', () => {
      global.deepstreamConfDir = './test/test-configs'
      const config = defaultConfig.get()

      config.auth = {
        type: 'file',
        options: {
          path: './users.json'
        }
      }
      configInitialiser.initialise(config)
      expect(config.authenticationHandler.type).toContain('file using')
      expect(config.authenticationHandler.type).toContain(path.resolve('test/test-configs/users.json'))
    })

    it('works for authtype: http', () => {
      const config = defaultConfig.get()

      config.auth = {
        type: 'http',
        options: {
          endpointUrl: 'http://some-url.com',
          permittedStatusCodes: [200],
          requestTimeout: 2000
        }
      }

      configInitialiser.initialise(config)
      expect(config.authenticationHandler.type).toBe('http webhook to http://some-url.com')
    })

    it('fails for missing auth sections', () => {
      const config = defaultConfig.get()

      delete config.auth

      expect(() => {
        configInitialiser.initialise(config)
      }).toThrowError('No authentication type specified')
    })

    it('allows passing a custom authentication handler', () => {
      const config = defaultConfig.get()

      config.auth = {
        path: '../mocks/auth-handler-mock',
        options: {
          hello: 'there'
        }
      }

      configInitialiser.initialise(config)
      expect(config.authenticationHandler.isReady).toBe(true)
      expect(config.authenticationHandler.options).toEqual({ hello: 'there' })
    })

    it('tries to find a custom authentication handler from name', () => {
      const config = defaultConfig.get()

      config.auth = {
        name: 'my-custom-auth-handler',
      }

      expect(() => {
        configInitialiser.initialise(config)
      }).toThrowError(/Cannot find module/)
    })

    it('fails for unknown auth types', () => {
      const config = defaultConfig.get()

      config.auth = {
        type: 'bla',
        options: {}
      }

      expect(() => {
        configInitialiser.initialise(config)
      }).toThrowError('Unknown authentication type bla')
    })

    it('overrides with type "none" when disableAuth is set', () => {
      global.deepstreamCLI = { disableAuth: true }
      const config = defaultConfig.get()

      config.auth = {
        type: 'http',
        options: {}
      }

      configInitialiser.initialise(config)
      expect(config.authenticationHandler.type).toBe('none')
      delete global.deepstreamCLI
    })
  })

  describe('creates the permissionHandler', () => {
    it('creates the config permission handler', () => {
      global.deepstreamConfDir = './test/test-configs'
      const config = defaultConfig.get()

      config.permission = {
        type: 'config',
        options: {
          path: './basic-permission-config.json'
        }
      }
      configInitialiser.initialise(config)
      expect(config.permissionHandler.type).toContain('valve permissions loaded from')
      expect(config.permissionHandler.type).toContain(path.resolve('test/test-configs/basic-permission-config.json'))
    })

    it('fails for invalid permission types', () => {
      const config = defaultConfig.get()

      config.permission = {
        type: 'does-not-exist',
        options: {
          path: './test/test-configs/basic-permission-config.json'
        }
      }
      expect(() => {
        configInitialiser.initialise(config)
      }).toThrowError('Unknown permission type does-not-exist')
    })

    it('allows passing a custom permission handler', () => {
      const config = defaultConfig.get()

      config.auth = {
        path: '../mocks/perm-handler-mock',
        options: {
          hello: 'there'
        }
      }

      configInitialiser.initialise(config)
      expect(config.authenticationHandler.isReady).toBe(true)
      expect(config.authenticationHandler.options).toEqual({ hello: 'there' })
    })

    it('tries to find a custom authentication handler from name', () => {
      const config = defaultConfig.get()

      config.auth = {
        name: 'my-custom-perm-handler',
      }

      expect(() => {
        configInitialiser.initialise(config)
      }).toThrowError(/Cannot find module/)
    })

    it('fails for missing permission configs', () => {
      const config = defaultConfig.get()
      delete config.permission

      expect(() => {
        configInitialiser.initialise(config)
      }).toThrowError('No permission type specified')
    })

    it('overrides with type "none" when disablePermissions is set', () => {
      global.deepstreamCLI = { disablePermissions: true }
      const config = defaultConfig.get()

      config.permission = {
        type: 'config',
        options: {}
      }

      configInitialiser.initialise(config)
      expect(config.permissionHandler.type).toBe('none')
      delete global.deepstreamCLI
    })
  })

  describe('supports custom loggers', () => {
    it('load the default logger with options', () => {
      global.deepstreamLibDir = null
      const config = defaultConfig.get()

      config.logger = {
        name: 'default',
        options: {
          logLevel: 2
        }
      }
      configInitialiser.initialise(config)
      expect(config.logger._options).toEqual({ logLevel: 2 })
    })

    it('load a custom logger', () => {
      global.deepstreamLibDir = null
      const config = defaultConfig.get()

      config.logger = {
        path: './test/test-helper/custom-logger',
        options: {
          a: 1
        }
      }
      configInitialiser.initialise(config)
      expect(config.logger.options).toEqual({ a: 1 })
    })

    it('throw an error for a unsupported logger type', (next) => {
      const config = defaultConfig.get()

      config.logger = {
        norNameNorPath: 'foo',
      }
      try {
        configInitialiser.initialise(config)
        next.fail('should fail')
      } catch (err) {
        expect(err.toString()).toContain('Neither name nor path property found')
        next()
      }
    })
  })
})
