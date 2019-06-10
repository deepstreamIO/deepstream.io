import 'mocha'
import { expect } from 'chai'
import * as C from '../constants'
import AuthenticationHandler from './http-authentication-handler'
import TestHttpServer from '../test/helper/test-http-server'
import MockLogger from '../test/mock/logger-mock'

describe('it forwards authentication attempts as http post requests to a specified endpoint', () => {
  let authenticationHandler
  let server
  const port = TestHttpServer.getRandomPort()
  const logger = new MockLogger()

  before((done) => {
    server = new TestHttpServer(port, done)
  })

  after((done) => {
    server.close(done)
  })

  before (() => {
    const endpointUrl = `http://localhost:${port}`

    authenticationHandler = new AuthenticationHandler({
      endpointUrl,
      permittedStatusCodes: [200],
      requestTimeout: 60,
      promoteToHeader: ['token']
    }, logger)
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
      expect(logger._log).to.have.callCount(0)
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
      expect(logger._log).to.have.been.calledWith(2, C.EVENT.AUTH_ERROR, 'http auth server error: "oh dear"')
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

  it('times out', (done) => {
    const connectionData = { connection: 'data' }
    const authData = { username: 'userA' }

    server.once('request-received', () => {
      // don't respond
    })

    logger._log.resetHistory()

    authenticationHandler.isValidUser(connectionData, authData, (result, data) => {
      expect(result).to.equal(false)
      expect(logger._log).to.have.been.calledWith(2, C.EVENT.AUTH_ERROR, 'http auth error: Error: socket hang up')
      expect(data).to.equal(null)
      server.respondWith(200)
      done()
    })
  })
})
