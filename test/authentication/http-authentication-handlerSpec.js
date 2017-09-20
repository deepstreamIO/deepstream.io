/* global jasmine, describe, it, expect */
/* eslint-disable no-undef */
'use strict'

const AuthenticationHandler = require('../../src/authentication/http-authentication-handler')
const TestHttpServer = require('../test-helper/test-http-server')
const MockLogger = require('../mocks/logger-mock')

describe('it forwards authentication attempts as http post requests to a specified endpoint', () => {
  let authenticationHandler
  let server
  const port = TestHttpServer.getRandomPort()
  const logger = new MockLogger()

  beforeAll((done) => {
    server = new TestHttpServer(port, done)
  })

  afterAll((done) => {
    server.close(done)
  })

  it('creates the authentication handler', () => {
    const endpointUrl = `http://localhost:${port}`

    authenticationHandler = new AuthenticationHandler({
      endpointUrl,
      permittedStatusCodes: [200],
      requestTimeout: 60,
    }, logger)
    expect(authenticationHandler.type).toBe(`http webhook to ${endpointUrl}`)
  })

  it('issues a request when isValidUser is called and receives 200 in return', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).toEqual({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).toBe('POST')
      expect(server.lastRequestHeaders['content-type']).toContain('application/json')
      server.respondWith(200, { authData: { extra: 'data' } })
    })

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).toBe(true)
      expect(data).toEqual({ authData: { extra: 'data' } })
      done()
    })
  })

  it('issues a request when isValidUser is called and receives 401 (denied) in return', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).toEqual({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).toBe('POST')
      expect(server.lastRequestHeaders['content-type']).toContain('application/json')
      server.respondWith(401)
    })

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).toBe(false)
      expect(data).toBe(null)
      expect(logger.log.calls.count()).toBe(0)
      done()
    })
  })

  it('receives a positive response without data', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).toEqual({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).toBe('POST')
      expect(server.lastRequestHeaders['content-type']).toContain('application/json')
      server.respondWith(200, '')
    })

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).toBe(true)
      expect(data).toBe(null)
      done()
    })
  })

  it('receives a positive response with only a string', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).toEqual({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).toBe('POST')
      expect(server.lastRequestHeaders['content-type']).toContain('application/json')
      server.respondWith(200, 'userA')
    })

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).toBe(true)
      expect(data).toEqual({ username: 'userA' })
      done()
    })
  })

  it('receives a server error as response', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      server.respondWith(500, 'oh dear')
    })

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).toBe(false)
      expect(logger.log).toHaveBeenCalledWith(2, 'AUTH_ERROR', 'http auth server error: oh dear')
      expect(data).toBe('oh dear')
      done()
    })
  })

  it('times out', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      // don't respond
    })

    logger.log.calls.reset()

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).toBe(false)
      expect(logger.log).toHaveBeenCalledWith(2, 'AUTH_ERROR', 'http auth error: Error: socket hang up')
      expect(data).toBeNull()
      server.respondWith(200)
      done()
    })
  })
})
