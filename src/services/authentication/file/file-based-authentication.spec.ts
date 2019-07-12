import 'mocha'
import { spy, assert } from 'sinon'
import { expect } from 'chai'
import { FileBasedAuthentication } from './file-based-authentication'
import { Logger, DeepstreamServices, EVENT } from '../../../types'
import { PromiseDelay } from '../../../utils/utils';

const createServices = () => {
  return {
    logger: { fatal: spy() } as never as Logger
  } as DeepstreamServices
}

const testAuthentication = (settings) => {
  const authData = {
    username: settings.username,
    password: settings.password
  }

  const callback = function (result, data) {
    expect(result).to.eq(settings.expectedResult)

    if (settings.expectedResult) {
      expect(data).to.deep.eq({
        username: settings.username,
        serverData: settings.serverData,
        clientData: settings.clientData
      })
    } else {
      expect(data).to.equal(undefined)
    }

    settings.done()
  }

  settings.handler.isValidUser(null, authData, callback)
}

describe('file based authentication', () => {
  describe('does authentication for cleartext passwords', () => {
    let authenticationHandler
    const settings = {
      path: './src/test/config/users-unhashed.json',
      hash: false
    }

    beforeEach(async () => {
      authenticationHandler = new FileBasedAuthentication(settings as any, createServices())
      await authenticationHandler.whenReady()
      expect(authenticationHandler.description).to.eq('file using ./src/test/config/users-unhashed.json')
    })

    it('confirms userC with valid password', (done) => {
      testAuthentication({
        username: 'userC',
        password: 'userCPass',
        expectedResult: true,
        serverData: { some: 'values' },
        clientData: { all: 'othervalue' },
        done,
        handler: authenticationHandler
      })
    })

    it('confirms userD with valid password', (done) => {
      testAuthentication({
        username: 'userD',
        password: 'userDPass',
        expectedResult: true,
        serverData: null,
        clientData: { all: 'client data' },
        done,
        handler: authenticationHandler
      })
    })

    it('rejects userC with invalid password', (done) => {
      testAuthentication({
        username: 'userC',
        password: 'userDPass',
        expectedResult: false,
        serverData: null,
        clientData: null,
        done,
        handler: authenticationHandler
      })
    })
  })

  describe('does authentication for hashed passwords', () => {
    let authenticationHandler
    const settings = {
      path: './src/test/config/users.json',
      hash: 'md5',
      iterations: 100,
      keyLength: 32
    }

    beforeEach(async () => {
      authenticationHandler = new FileBasedAuthentication(settings as any, createServices())
      await authenticationHandler.whenReady()
    })

    it('confirms userA with valid password', (done) => {
      testAuthentication({
        username: 'userA',
        password: 'userAPass',
        expectedResult: true,
        serverData: { some: 'values' },
        clientData: { all: 'othervalue' },
        done,
        handler: authenticationHandler
      })
    })

    it('rejects userA with an invalid password', (done) => {
      testAuthentication({
        username: 'userA',
        password: 'wrongPassword',
        expectedResult: false,
        done,
        handler: authenticationHandler
      })
    })

    it('rejects userA with user B\'s password', (done) => {
      testAuthentication({
        username: 'userA',
        password: 'userBPass',
        expectedResult: false,
        done,
        handler: authenticationHandler
      })
    })

    it('accepts userB with user B\'s password', (done) => {
      testAuthentication({
        username: 'userB',
        password: 'userBPass',
        expectedResult: true,
        serverData: null,
        clientData: { all: 'client data' },
        done,
        handler: authenticationHandler
      })
    })

    it('rejects unknown userQ', (done) => {
      testAuthentication({
        username: 'userQ',
        password: 'userBPass',
        expectedResult: false,
        done,
        handler: authenticationHandler
      })
    })
  })

  describe('errors for invalid settings', () => {
    const getSettings = function () {
      return {
        path: './src/test/config/users.json',
        hash: 'md5',
        iterations: 100,
        keyLength: 32
      }
    }

    it('errors for invalid path', async () => {
      const settings = getSettings()
      settings.path = 'xcc'
      const services = createServices()
      const x = new FileBasedAuthentication(settings as any, services)
      await PromiseDelay(0)
      assert.calledOnce(services.logger.fatal)
      assert.calledWithExactly(services.logger.fatal, EVENT.PLUGIN_INITIALIZATION_ERROR, "Error loading file xcc")
    })

    it('accepts settings with hash = false', () => {
      const settings = {
        path: './src/test/config/users-unhashed.json',
        hash: false
      }

      expect(() => {
        // tslint:disable-next-line:no-unused-expression
        new FileBasedAuthentication(settings as any)
      }).not.to.throw()
    })

    it('fails for settings with hash=string that miss hashing parameters', () => {
      const settings = {
        path: './src/test/config/users-unhashed.json',
        hash: 'md5'
      }

      expect(() => {
        // tslint:disable-next-line:no-unused-expression
        new FileBasedAuthentication(settings as any)
      }).to.throw()
    })

    it('fails for settings with non-existing hash algorithm', () => {
      const settings = getSettings()
      settings.hash = 'does-not-exist'

      expect(() => {
        // tslint:disable-next-line:no-unused-expression
        new FileBasedAuthentication(settings)
      }).to.throw()
    })
  })

  describe('creates hashes', () => {
    let authenticationHandler
    const settings = {
      path: './src/test/config/users.json',
      hash: 'md5',
      iterations: 100,
      keyLength: 32
    }

    beforeEach(async () => {
      authenticationHandler = new FileBasedAuthentication(settings, createServices())
      await authenticationHandler.whenReady()
    })

    it('creates a hash', (done) => {
      authenticationHandler.createHash('userAPass', (err, result) => {
        expect(err).to.eq(null)
        expect(typeof result).to.eq('string')
        done()
      })
    })
  })

  describe('errors for invalid configs', () => {
    const test = async (settings: any, errorMessage: string) => {
      const services = createServices()
      // tslint:disable-next-line: no-unused-expression
      new FileBasedAuthentication(settings, services)
      await PromiseDelay(10)
      assert.calledOnce(services.logger.fatal)
      assert.calledWithExactly(services.logger.fatal, EVENT.PLUGIN_INITIALIZATION_ERROR, errorMessage)
    }

    it('loads a non existant config', async () => {
      await test({
        path: './does-not-exist.json',
        hash: false
      }, 'Error loading file ./does-not-exist.json')
    })

    it('loads a user config without password field',async () => {
      await test({
        path: './src/test/config/invalid-user-config.json',
        hash: false
      }, 'missing password for userB')
    })

    it('loads a user config without without blank user file', async() => {
      await test({
        path: './src/test/config/blank-config.json',
        hash: false
      }, 'Error loading file ./src/test/config/blank-config.json')  
    })

    it('loads a user config without without no users', async() => {
      await test({
        path: './src/test/config/empty-map-config.json',
        hash: false
      }, 'no users present in user file')  
    })
  })

  describe('errors for invalid auth-data', () => {
    let authenticationHandler
    const settings = {
      path: './src/test/config/users.json',
      hash: 'md5',
      iterations: 100,
      keyLength: 32
    }

    beforeEach(async () => {
      authenticationHandler = new FileBasedAuthentication(settings, createServices())
      await authenticationHandler.whenReady()
    })

    it('returns an error for authData without username', (done) => {
      const authData = {
        password: 'some password'
      }

      const callback = function (result, data) {
        expect(result).to.eq(false)
        expect(data.clientData).to.deep.eq({ error: 'missing authentication parameter username' })
        done()
      }

      authenticationHandler.isValidUser(null, authData, callback)
    })

    it('returns an error for authData without password', (done) => {
      const authData = {
        username: 'some user'
      }

      const callback = function (result, data) {
        expect(result).to.eq(false)
        expect(data.clientData).to.deep.eq({ error: 'missing authentication parameter password' })
        done()
      }

      authenticationHandler.isValidUser(null, authData, callback)
    })
  })
})
