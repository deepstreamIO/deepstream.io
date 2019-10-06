import 'mocha'
import { spy, assert } from 'sinon'
import { expect } from 'chai'
import { FileBasedAuthentication } from './file-based-authentication'
import { DeepstreamServices, EVENT } from '../../../../ds-types/src/index'
import { PromiseDelay } from '../../../utils/utils';

const createServices = () => {
  return {
    logger: { fatal: spy() } as never as Logger
  } as DeepstreamServices
}

const testAuthentication = async ({ username, password, handler, notFound, isValid, clientData, serverData }) => {
  const result = await handler.isValidUser(null, { username, password })
  if (notFound) {
    expect(result).to.equal(null)
    return
  }
  expect(result.isValid).to.eq(isValid)

  if (isValid) {
    expect(result.id).to.equal(username)
    expect(result.clientData).to.deep.equal(clientData)
    expect(result.serverData).to.deep.equal(serverData)
  } else {
    expect(result).to.deep.equal({ isValid })
  }
}

describe('file based authentication', () => {

  describe('does authentication for cleartext passwords', () => {
    let authenticationHandler

    beforeEach(async () => {
      authenticationHandler = new FileBasedAuthentication({
        path: './src/test/config/users-unhashed.json',
        hash: false
      }, createServices())
      await authenticationHandler.whenReady()
      expect(authenticationHandler.description).to.eq('file using ./src/test/config/users-unhashed.json')
    })

    it('confirms userC with valid password', async () => {
      await testAuthentication({
        handler: authenticationHandler,
        username: 'userC',
        password: 'userCPass',
        isValid: true,
        serverData: { some: 'values' },
        clientData: { all: 'othervalue' }
      })
    })

    it('confirms userD with valid password', async () => {
      await testAuthentication({
        username: 'userD',
        password: 'userDPass',
        isValid: true,
        serverData: null,
        clientData: { all: 'client data' },
        handler: authenticationHandler
      })
    })

    it('rejects userC with invalid password', async () => {
      await testAuthentication({
        username: 'userC',
        password: 'userDPass',
        isValid: false,
        serverData: null,
        clientData: null,
        handler: authenticationHandler
      })
    })
  })

  describe('does authentication for hashed passwords', () => {
    let authenticationHandler

    beforeEach(async () => {
      authenticationHandler = new FileBasedAuthentication({
        path: './src/test/config/users.json',
        hash: 'md5',
        iterations: 100,
        keyLength: 32,
        reportInvalidParameters: true
      }, createServices())
      await authenticationHandler.whenReady()
    })

    it('confirms userA with valid password', async () => {
      await testAuthentication({
        handler: authenticationHandler,
        username: 'userA',
        password: 'userAPass',
        isValid: true,
        serverData: { some: 'values' },
        clientData: { all: 'othervalue' }
      })
    })

    it('rejects userA with an invalid password', async () => {
      await testAuthentication({
        username: 'userA',
        password: 'wrongPassword',
        isValid: false,
        handler: authenticationHandler
      })
    })

    it('rejects userA with user B\'s password', async () => {
      await testAuthentication({
        username: 'userA',
        password: 'userBPass',
        isValid: false,
        handler: authenticationHandler
      })
    })

    it('accepts userB with user B\'s password', async () => {
      await testAuthentication({
        username: 'userB',
        password: 'userBPass',
        isValid: true,
        serverData: null,
        clientData: { all: 'client data' },
        handler: authenticationHandler
      })
    })

    it('returns null for userQ', async () => {
      await testAuthentication({
        handler: authenticationHandler,
        username: 'userQ',
        password: 'userBPass',
        notFound: true,
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
      await PromiseDelay(10)
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
      keyLength: 32,
      reportInvalidParameters: true
    }

    beforeEach(async () => {
      authenticationHandler = new FileBasedAuthentication(settings, createServices())
      await authenticationHandler.whenReady()
    })

    it('returns null for authData without username', async () => {
      const result = await authenticationHandler.isValidUser(null, {
        password: 'some password'
      })
      expect(result.isValid).to.eq(false)
      expect(result.clientData).to.deep.eq({ error: 'missing authentication parameter: username or/and password' })
    })

    it('returns an error for authData without password', async () => {
      const result = await authenticationHandler.isValidUser(null, {
        username: 'some user'
      })
      expect(result.isValid).to.eq(false)
      expect(result.clientData).to.deep.eq({ error: 'missing authentication parameter: username or/and password' })
    })
  })
})
