import { expect } from 'chai'

import * as path from 'path'
import * as defaultConfig from '../default-options'
import * as configInitialiser from './config-initialiser'
import { EventEmitter } from 'events'

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
        custom: {
          path: './src/test/mock/plugin-mock',
          options: { some: 'options' }
        }
      } as any
      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.plugins.custom.description).to.equal('mock-plugin')
    })

    it('loads plugins via module names', () => {
      const config = defaultConfig.get()
      config.plugins = {
        cache: {
          path: 'n0p3',
          options: {}
        }
      } as any
      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.toString()).to.equal('[object Object]')
    })

    it('loads plugins from a relative path and lib dir', () => {
      global.deepstreamLibDir = './src/test/mock'

      const config = defaultConfig.get()
      config.plugins = {
        mock: {
          path: './plugin-mock',
          options: { some: 'options' }
        }
      } as any
      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.plugins.mock.description).to.equal('mock-plugin')
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
        configInitialiser.initialise(new EventEmitter(), config)
      } catch (e) {
        errored = true
        expect(e.toString()).to.contain(path.join('/foobar', '@deepstream/cache-blablub'))
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
      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.authentication.description).to.equal('Open Authentication')
    })

    it('works for authtype: user', () => {
      const config = defaultConfig.get()

      config.auth = {
        type: 'file',
        options: {
          path: './users.json'
        }
      }
      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.authentication.description).to.contain('file using')
      expect(result.services.authentication.description).to.contain('./users.json')
    })

    it('works for authtype: http', () => {
      const config = defaultConfig.get()

      config.auth = {
        type: 'http',
        options: {
          endpointUrl: 'http://some-url.com',
          permittedStatusCodes: [200],
          requestTimeout: 2000,
          retryAttempts: 2,
          retryInterval: 50,
          retryStatusCodes: [ 404 ]
        }
      }

      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.authentication.description).to.equal('http webhook to http://some-url.com')
    })

    it('fails for missing auth sections', () => {
      const config = defaultConfig.get()

      delete config.auth

      expect(() => {
        configInitialiser.initialise(new EventEmitter(), config)
      }).to.throw('No authentication type specified')
    })

    it('allows passing a custom authentication handler', async () => {
      const config = defaultConfig.get()

      config.auth = {
        path: '../mock/authentication-handler-mock',
        options: {
          hello: 'there'
        }
      }

      const result = configInitialiser.initialise(new EventEmitter(), config)
      await result.services.authentication.whenReady()
    })

    it('tries to find a custom authentication handler from name', () => {
      const config = defaultConfig.get()

      config.auth = {
        name: 'my-custom-auth-handler',
        options: {}
      }

      expect(() => {
        configInitialiser.initialise(new EventEmitter(), config)
      }).to.throw(/Cannot load module/)
    })

    it('fails for unknown auth types', () => {
      const config = defaultConfig.get()

      config.auth = {
        type: 'bla',
        options: {}
      }

      expect(() => {
        configInitialiser.initialise(new EventEmitter(), config)
      }).to.throw('Unknown authentication type bla')
    })

    it('overrides with type "none" when disableAuth is set', () => {
      global.deepstreamCLI = { disableAuth: true }
      const config = defaultConfig.get()

      config.auth = {
        type: 'http',
        options: {}
      }

      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.authentication.description).to.equal('Open Authentication')
      delete global.deepstreamCLI
    })
  })

  describe('creates the permission service', () => {
    it('creates the config permission service', () => {
      const config = defaultConfig.get()

      config.permission = {
        type: 'config',
        options: {
          path: './basic-permission-config.json'
        }
      }
      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.permission.description).to.contain('valve permissions loaded from')
      expect(result.services.permission.description).to.contain('./basic-permission-config.json')
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
        configInitialiser.initialise(new EventEmitter(), config)
      }).to.throw('Unknown permission type does-not-exist')
    })

    it('allows passing a custom permission handler', async () => {
      const config = defaultConfig.get()

      config.permission = {
        path: '../mock/permission-handler-mock',
        options: {
          hello: 'there'
        }
      }

      const result = configInitialiser.initialise(new EventEmitter(), config)
      await result.services.permission.whenReady()
    })

    it('tries to find a custom authentication handler from name', () => {
      const config = defaultConfig.get()

      config.auth = {
        name: 'my-custom-perm-handler',
        options: {}
      }

      expect(() => {
        configInitialiser.initialise(new EventEmitter(), config)
      }).to.throw(/Cannot load module/)
    })

    it('fails for missing permission configs', () => {
      const config = defaultConfig.get()
      delete config.permission

      expect(() => {
        configInitialiser.initialise(new EventEmitter(), config)
      }).to.throw('No permission type specified')
    })

    it('overrides with type "none" when disablePermissions is set', () => {
      global.deepstreamCLI = { disablePermissions: true }
      const config = defaultConfig.get()

      config.permission = {
        type: 'config',
        options: {}
      }

      const result = configInitialiser.initialise(new EventEmitter(), config)
      expect(result.services.permission.description).to.equal('none')
      delete global.deepstreamCLI
    })
  })
})
