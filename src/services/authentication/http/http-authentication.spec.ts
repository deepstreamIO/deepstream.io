import 'mocha'
import { expect } from 'chai'
import TestHttpServer from '../../../test/helper/test-http-server'
import MockLogger from '../../../test/mock/logger-mock'
import { PromiseDelay } from '../../../utils/utils';
import * as testHelper from '../../../test/helper/test-helper'
import { HttpAuthentication } from './http-authentication';
import { EVENT } from '@deepstream/types'

describe('it forwards authentication attempts as http post requests to a specified endpoint', () => {
  let authenticationHandler
  let server
  const port = TestHttpServer.getRandomPort()
  const { config, services} = testHelper.getDeepstreamOptions()
  let logSpy

  before((done) => {
    server = new TestHttpServer(port, done)
    logSpy = (services.logger as MockLogger).logSpy
    logSpy.resetHistory()
  })

  after((done) => {
    server.close(done)
  })

  before (() => {
    const endpointUrl = `http://localhost:${port}`

    authenticationHandler = new HttpAuthentication({
      endpointUrl,
      permittedStatusCodes: [200],
      requestTimeout: 60,
      promoteToHeader: ['token'],
      retryAttempts: 2,
      retryInterval: 30,
      retryStatusCodes: [404, 504]
    }, services, config)
    expect(authenticationHandler.description).to.equal(`http webhook to ${endpointUrl}`)
  })

  it('issues a request when isValidUser is called and receives 200 in return', async () => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).to.deep.equal({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).to.equal('POST')
      expect(server.lastRequestHeaders['content-type']).to.contain('application/json')
      server.respondWith(200, { serverData: { extra: 'data' }, clientData: { color: 'red' }, id: "123" })
    })

    const result = await authenticationHandler.isValidUser(connectionData, authData)
    expect(result.isValid).to.equal(true)
    expect(result.id).to.equal("123")
    expect(result.serverData).to.deep.equal({ extra: 'data' })
    expect(result.clientData).to.deep.equal({ color: 'red' })
  })

  it('issues a request when isValidUser is called and receives 401 (denied) in return', async () => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).to.deep.equal({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).to.equal('POST')
      expect(server.lastRequestHeaders['content-type']).to.contain('application/json')
      server.respondWith(401)
    })

    const result = await authenticationHandler.isValidUser(connectionData, authData)
    expect(result.isValid).to.equal(false)
    expect(result.serverData).to.equal(undefined)
    expect(result.clientData).to.equal(undefined)
    expect(logSpy).to.have.callCount(0)
  })

  it('receives a positive response without data', async () => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).to.deep.equal({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).to.equal('POST')
      expect(server.lastRequestHeaders['content-type']).to.contain('application/json')
      server.respondWith(200, '')
    })

    const result = await authenticationHandler.isValidUser(connectionData, authData)
    expect(result.isValid).to.equal(true)
    expect(result.serverData).to.equal(undefined)
    expect(result.clientData).to.equal(undefined)
  })

  it('receives a positive response with only a string', async () => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).to.deep.equal({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).to.equal('POST')
      expect(server.lastRequestHeaders['content-type']).to.contain('application/json')
      server.respondWith(200, 'userA')
    })

    const result = await authenticationHandler.isValidUser(connectionData, authData)
    expect(result.isValid).to.equal(true)
    expect(result.id).to.deep.equal('userA')
  })

  it('receives a server error as response', async () => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      server.respondWith(500, 'oh dear')
    })

    const result = await authenticationHandler.isValidUser(connectionData, authData)
    expect(result.isValid).to.equal(false)
    expect(logSpy).to.have.been.calledWith(2, EVENT.AUTH_ERROR, 'http auth server error: "oh dear"')
    expect(result.clientData).to.deep.equal({ error: 'oh dear' })
  })

  it('promotes headers from body if provides', async () => {
    const connectionData = { connection: 'data' }
    const authData = { token: 'a-token' }

    server.once('request-received', () => {
      server.respondWith(200, {})
    })

    const result = await authenticationHandler.isValidUser(connectionData, authData)
    expect(result.isValid).to.equal(true)
    expect(result.clientData).to.equal(undefined)
    expect(result.serverData).to.equal(undefined)
    expect(server.getRequestHeader('token')).to.equal('a-token')
  })

  describe('retries', () => {
    const connectionData = { connection: 'data' }
    const authData = { token: 'a-token' }

    beforeEach(() => {
      server.once('request-received', () => server.respondWith(404, {}))
    })

    it ('doesn\'t fail if the response returned is retry code', async () => {
      let called = false
      authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
        called = true
      })
      await PromiseDelay(20)
      expect(called).to.equal(false)
    })

    it.skip ('returns true if the second attempt is valid', async () => {
      let done
      const result = new Promise((resolve) => done = resolve)

      authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
        expect(result).to.equal(true)
        expect(data).to.deep.equal({ what: '2nd-attempt' })
        done()
      })

      await PromiseDelay(30)
      server.once('request-received', () => server.respondWith(200, { what: '2nd-attempt' }))

      await result
    })

    // TODO: Always passing
    it ('returns invalid if retry attempts are exceeded', async () => {
      const isValidUser = authenticationHandler.isValidUser(connectionData, authData)

      await PromiseDelay(30)
      server.once('request-received', () => server.respondWith(404, {}))

      await PromiseDelay(30)
      server.once('request-received', () => server.respondWith(504, {}))

      const result = await isValidUser
      expect(result.isValid).to.equal(false)
      expect(result.clientData).to.deep.equal({ error: EVENT.AUTH_RETRY_ATTEMPTS_EXCEEDED })
    })
  })

  it('times out', async () => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    const response = await authenticationHandler.isValidUser(connectionData, authData)
    expect(response.isValid).to.equal(false)
    expect(logSpy).to.have.been.calledWith(2, EVENT.AUTH_ERROR, 'http auth error: Error: socket hang up')
    expect(response.clientData).to.deep.equal({ error: EVENT.AUTH_RETRY_ATTEMPTS_EXCEEDED })
    server.respondWith(200)
  })
})
