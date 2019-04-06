import { expect } from 'chai'

import * as path from 'path'
import * as defaultConfig from '../default-options'
import * as configInitialiser from './config-initialiser'

describe('config-initialiser', () => {
  before(() => {
    global.deepstreamConfDir = null
    global.deepstreamLibDir = null
    global.deepstreamCLI = null
  })

  describe('plugins are initialised as per configuration', () => {
    it('loads plugins from a relative path', () => {
      const config = defaultConfig.get()
      config.plugins = {
        cache: {
          path: './src/test/mock/plugin-mock',
          options: { some: 'options' }
        }
      } as any
      const result = configInitialiser.initialise(config)
      expect(result.services.cache.description).to.equal('mock-plugin')
    })

    it('loads plugins via module names', () => {
      const config = defaultConfig.get()
      config.plugins = {
        cache: {
          path: 'n0p3',
          options: {}
        }
      } as any
      const result = configInitialiser.initialise(config)
      expect(result.services.toString()).to.equal('[object Object]')
    })

    it('loads plugins from a relative path and lib dir', () => {
      global.deepstreamLibDir = './src/test/mock'

      const config = defaultConfig.get()
      config.plugins = {
        cache: {
          path: './plugin-mock',
          options: { some: 'options' }
        }
      } as any
      const result = configInitialiser.initialise(config)
      expect(result.services.cache.description).to.equal('mock-plugin')
    })
  })

  describe('ssl files are loaded if provided', () => {
    it.skip('fails with incorrect path passed in', () => {
      ['sslKey', 'sslCert', 'sslCa'].forEach((key) => {
        const config = defaultConfig.get()
        config[key] = './does-not-exist'
        expect(() => {
          configInitialiser.initialise(config)
        }).to.throw(new Error())
      })
    })

    it('loads sslFiles from a relative path and a config prefix', () => {
      global.deepstreamConfDir = './src/test/config/'

      const config = defaultConfig.get()
      config.sslKey = './sslKey.pem'
      const result = configInitialiser.initialise(config)
      expect(result.config.sslKey).to.equal('I\'m a key')
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
      } as any
      try {
        configInitialiser.initialise(config)
      } catch (e) {
        errored = true
        expect(e.toString()).to.contain(path.join('/foobar', 'deepstream.io-cache-blablub'))
      }

      expect(errored).to.equal(true)
    })
  })

  describe('creates the right authentication handler', () => {
    before(() => {
      global.deepstreamLibDir = './src/test/plugins'
    })

    it('works for authtype: none', () => {
      const config = defaultConfig.get()

      config.auth = {
        type: 'none'
      } as any
      const result = configInitialiser.initialise(config)
      expect(result.services.authenticationHandler.description).to.equal('none')
    })

    it('works for authtype: user', () => {
      global.deepstreamConfDir = './src/test/config/'
      const config = defaultConfig.get()

      config.auth = {
        type: 'file',
        options: {
          path: './users.json'
        }
      }
      const result = configInitialiser.initialise(config)
      expect(result.services.authenticationHandler.description).to.contain('file using')
      expect(result.services.authenticationHandler.description).to.contain(path.resolve('src/test/config/users.json'))
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

      const result = configInitialiser.initialise(config)
      expect(result.services.authenticationHandler.description).to.equal('http webhook to http://some-url.com')
    })

    it('fails for missing auth sections', () => {
      const config = defaultConfig.get()

      delete config.auth

      expect(() => {
        configInitialiser.initialise(config)
      }).to.throw('No authentication type specified')
    })

    it('allows passing a custom authentication handler', () => {
      const config = defaultConfig.get()

      config.auth = {
        path: '../mock/authentication-handler-mock',
        options: {
          hello: 'there'
        }
      }

      const result = configInitialiser.initialise(config)
      expect(result.services.authenticationHandler.isReady).to.equal(true)
    })

    it('tries to find a custom authentication handler from name', () => {
      const config = defaultConfig.get()

      config.auth = {
        name: 'my-custom-auth-handler',
        options: {}
      }

      expect(() => {
        configInitialiser.initialise(config)
      }).to.throw(/Cannot find module/)
    })

    it('fails for unknown auth types', () => {
      const config = defaultConfig.get()

      config.auth = {
        type: 'bla',
        options: {}
      }

      expect(() => {
        configInitialiser.initialise(config)
      }).to.throw('Unknown authentication type bla')
    })

    it('overrides with type "none" when disableAuth is set', () => {
      global.deepstreamCLI = { disableAuth: true }
      const config = defaultConfig.get()

      config.auth = {
        type: 'http',
        options: {}
      }

      const result = configInitialiser.initialise(config)
      expect(result.services.authenticationHandler.description).to.equal('none')
      delete global.deepstreamCLI
    })
  })

  describe('creates the permissionHandler', () => {
    it('creates the config permission handler', () => {
      global.deepstreamConfDir = './src/test/config'
      const config = defaultConfig.get()

      config.permission = {
        type: 'config',
        options: {
          path: './basic-permission-config.json'
        }
      }
      const result = configInitialiser.initialise(config)
      expect(result.services.permissionHandler.description).to.contain('valve permissions loaded from')
      expect(result.services.permissionHandler.description).to.contain(path.resolve('./src/test/config/basic-permission-config.json'))
    })

    it('fails for invalid permission types', () => {
      const config = defaultConfig.get()

      config.permission = {
        type: 'does-not-exist',
        options: {
          path: './src/test/config/basic-permission-config.json'
        }
      }
      expect(() => {
        configInitialiser.initialise(config)
      }).to.throw('Unknown permission type does-not-exist')
    })

    it('allows passing a custom permission handler', () => {
      const config = defaultConfig.get()

      config.permission = {
        path: '../mock/permission-handler-mock',
        options: {
          hello: 'there'
        }
      }

      const result = configInitialiser.initialise(config)
      expect(result.services.permissionHandler.isReady).to.equal(true)
    })

    it('tries to find a custom authentication handler from name', () => {
      const config = defaultConfig.get()

      config.auth = {
        name: 'my-custom-perm-handler',
        options: {}
      }

      expect(() => {
        configInitialiser.initialise(config)
      }).to.throw(/Cannot find module/)
    })

    it('fails for missing permission configs', () => {
      const config = defaultConfig.get()
      delete config.permission

      expect(() => {
        configInitialiser.initialise(config)
      }).to.throw('No permission type specified')
    })

    it('overrides with type "none" when disablePermissions is set', () => {
      global.deepstreamCLI = { disablePermissions: true }
      const config = defaultConfig.get()

      config.permission = {
        type: 'config',
        options: {}
      }

      const result = configInitialiser.initialise(config)
      expect(result.services.permissionHandler.description).to.equal('none')
      delete global.deepstreamCLI
    })
  })
})
