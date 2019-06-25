import 'mocha'
import { expect } from 'chai'
import * as C from '../../../constants'
import TestHttpServer from '../../../test/helper/test-http-server'
import MockLogger from '../../../test/mock/logger-mock'
import { PromiseDelay } from '../../../utils/utils';
import { EVENT } from '../../../../binary-protocol/src/message-constants';
import * as testHelper from '../../../test/helper/test-helper'
import { HttpAuthentication } from './http-authentication';

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

  it('issues a request when isValidUser is called and receives 200 in return', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      expect(server.lastRequestData).to.deep.equal({
        connectionData: { connection: 'data' },
        authData: { username: 'userA' }
      })
      expect(server.lastRequestMethod).to.equal('POST')
      expect(server.lastRequestHeaders['content-type']).to.contain('application/json')
      server.respondWith(200, { authData: { extra: 'data' } })
    })

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).to.equal(true)
      expect(data).to.deep.equal({ authData: { extra: 'data' } })
      done()
    })
  })

  it('issues a request when isValidUser is called and receives 401 (denied) in return', (done) => {
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

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).to.equal(false)
      expect(data).to.equal(null)
      expect(logSpy).to.have.callCount(0)
      done()
    })
  })

  it('receives a positive response without data', (done) => {
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

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).to.equal(true)
      expect(data).to.equal(null)
      done()
    })
  })

  it('receives a positive response with only a string', (done) => {
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

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).to.equal(true)
      expect(data).to.deep.equal({ username: 'userA' })
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
      expect(result).to.equal(false)
      expect(logSpy).to.have.been.calledWith(2, C.EVENT.AUTH_ERROR, 'http auth server error: "oh dear"')
      expect(data).to.equal('oh dear')
      done()
    })
  })

  it('promotes headers from body if provides', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { token: 'a-token' }

    server.once('request-received', () => {
      server.respondWith(200, {})
    })

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).to.equal(true)
      expect(data).to.deep.equal({})
      expect(server.getRequestHeader('token')).to.equal('a-token')
      done()
    })
  })

  describe('retries', () => {
    const connectionData = { connection: 'data' }
    const authData = { token: 'a-token' }

    beforeEach(() => {
      server.once('request-received', () => server.respondWith(404, {}))
    })

    it ('doesnt fail if the reponse returned is rety code', async () => {
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

    it ('returns invalid if retry attempts are exceeded', async () => {
      let done
      const result = new Promise((resolve) => done = resolve)

      authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
        expect(result).to.equal(false)
        expect(data).to.deep.equal({ clientData: { error: EVENT.AUTH_RETRY_ATTEMPTS_EXCEEDED }})
        done()
      })

      await PromiseDelay(30)
      server.once('request-received', () => server.respondWith(404, {}))

      await PromiseDelay(30)
      server.once('request-received', () => server.respondWith(504, {}))

      await result
    })
  })

  it('times out', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).to.equal(false)
      expect(logSpy).to.have.been.calledWith(2, C.EVENT.AUTH_ERROR, 'http auth error: Error: socket hang up')
      expect(data).to.deep.equal({ clientData: { error: EVENT.AUTH_RETRY_ATTEMPTS_EXCEEDED }})
      server.respondWith(200)
      done()
    })
  })
})
