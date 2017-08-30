/* global describe, it, expect */
/* eslint-disable no-new */
'use strict'

const AuthenticationHandler = require('../../src/authentication/file-based-authentication-handler')

const testAuthentication = function (settings) {
  const authData = {
    username: settings.username,
    password: settings.password
  }

  const callback = function (result, data) {
    expect(result).toBe(settings.expectedResult)

    if (settings.expectedResult) {
      expect(data).toEqual({
        username: settings.username,
        serverData: settings.serverData,
        clientData: settings.clientData
      })
    } else {
      expect(data).toBeUndefined()
    }

    settings.done()
  }

  settings.handler.isValidUser(null, authData, callback)
}

describe('does authentication for cleartext passwords', () => {
  let authenticationHandler
  const settings = {
    path: './test/test-configs/users-unhashed.json',
    hash: false
  }

  it('creates the authentication handler', (done) => {
    authenticationHandler = new AuthenticationHandler(settings)
    authenticationHandler.on('ready', done)
    expect(authenticationHandler.type).toBe('file using ./test/test-configs/users-unhashed.json')
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
    path: './test/test-configs/users.json',
    hash: 'md5',
    iterations: 100,
    keyLength: 32
  }

  it('creates the authentication handler', (done) => {
    authenticationHandler = new AuthenticationHandler(settings)
    authenticationHandler.on('ready', done)
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
      path: './test/test-configs/users.json',
      hash: 'md5',
      iterations: 100,
      keyLength: 32
    }
  }

  it('accepts valid settings', () => {
    expect(() => {
      new AuthenticationHandler(getSettings())
    }).not.toThrow()
  })

  it('errors for invalid path', () => {
    const settings = getSettings()
    settings.path = 42
    expect(() => {
      new AuthenticationHandler(settings)
    }).toThrow()
  })

  it('accepts settings with hash = false', () => {
    const settings = {
      path: './test/test-configs/users-unhashed.json',
      hash: false
    }

    expect(() => {
      new AuthenticationHandler(settings)
    }).not.toThrow()
  })

  it('fails for settings with hash=string that miss hashing parameters', () => {
    const settings = {
      path: './test/test-configs/users-unhashed.json',
      hash: 'md5'
    }

    expect(() => {
      new AuthenticationHandler(settings)
    }).toThrow()
  })

  it('fails for settings with non-existing hash algorithm', () => {
    const settings = getSettings()
    settings.hash = 'does-not-exist'

    expect(() => {
      new AuthenticationHandler(settings)
    }).toThrow()
  })
})

describe('creates hashes', () => {
  let authenticationHandler
  const settings = {
    path: './test/test-configs/users.json',
    hash: 'md5',
    iterations: 100,
    keyLength: 32
  }

  it('creates the authentication handler', (done) => {
    authenticationHandler = new AuthenticationHandler(settings)
    authenticationHandler.on('ready', done)
  })

  it('creates a hash', (done) => {
    authenticationHandler.createHash('userAPass', (err, result) => {
      expect(err).toBe(null)
      expect(typeof result).toBe('string')
      done()
    })
  })
})

describe('errors for invalid configs', () => {
  it('loads a non existant config', (done) => {
    const authenticationHandler = new AuthenticationHandler({
      path: './does-not-exist.json',
      hash: false
    })
    authenticationHandler.on('error', (error) => {
      expect(error).toContain('no such file or directory')
      done()
    })
  })

  it('loads a broken config', (done) => {
    const authenticationHandler = new AuthenticationHandler({
      path: './test/test-configs/broken-json-config.json',
      hash: false
    })

    authenticationHandler.on('error', (error) => {
      expect(error.toString()).toContain('Unexpected token }')
      done()
    })
  })

  it('loads a user config without password field', (done) => {
    const authenticationHandler = new AuthenticationHandler({
      path: './test/test-configs/invalid-user-config.json',
      hash: false
    })

    authenticationHandler.on('error', (error) => {
      expect(error).toBe('missing password for userB')
      done()
    })
  })

  it('loads a user config without without blank user file', (done) => {
    const authenticationHandler = new AuthenticationHandler({
      path: './test/test-configs/blank-config.json',
      hash: false
    })

    authenticationHandler.on('error', (error) => {
      expect(error).toContain('Error loading file ./test/test-configs/blank-config.json')
      done()
    })
  })

  it('loads a user config without without no users', (done) => {
    const authenticationHandler = new AuthenticationHandler({
      path: './test/test-configs/empty-map-config.json',
      hash: false
    })

    authenticationHandler.on('error', (error) => {
      expect(error).toBe('no users present in user file')
      done()
    })
  })
})

describe('errors for invalid auth-data', () => {
  let authenticationHandler
  const settings = {
    path: './test/test-configs/users.json',
    hash: 'md5',
    iterations: 100,
    keyLength: 32
  }

  it('creates the authentication handler', (done) => {
    authenticationHandler = new AuthenticationHandler(settings)
    authenticationHandler.on('ready', done)
  })

  it('returns an error for authData without username', (done) => {
    const authData = {
      password: 'some password'
    }

    const callback = function (result, data) {
      expect(result).toBe(false)
      expect(data.clientData).toBe('missing authentication parameter username')
      done()
    }

    authenticationHandler.isValidUser(null, authData, callback)
  })

  it('returns an error for authData without password', (done) => {
    const authData = {
      username: 'some user'
    }

    const callback = function (result, data) {
      expect(result).toBe(false)
      expect(data.clientData).toBe('missing authentication parameter password')
      done()
    }

    authenticationHandler.isValidUser(null, authData, callback)
  })
})
