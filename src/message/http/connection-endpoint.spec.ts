import { expect } from 'chai'
const Promise = require('bluebird')
import * as needle from 'needle'

import * as C from '../../constants'
import LoggerMock from '../../test/mock/logger-mock'
import ConnectionEndpoint from './connection-endpoint'
import OpenPermissionHandler from '../../permission/open-permission-handler';
import OpenAuthenticationHandler from '../../authentication/open-authentication-handler';
import { DeepstreamServices, InternalDeepstreamConfig } from '../../types';

Promise.promisifyAll(needle)

const conf = {
  healthCheckPath: '/health-check',
  enableAuthEndpoint: true,
  authPath: '/api/v1/auth',
  postPath: '/api/v1',
  getPath: '/api/v1',
  port: 8888,
  host: '127.0.0.1',
  allowAllOrigins: true,
  requestTimeout: 30,
  maxMessageSize: 100000
}

const services = {
  logger: new LoggerMock(),
  authenticationHandler: new OpenAuthenticationHandler(),
  permissionHandler: new OpenPermissionHandler(),
  messageDistributor: { distribute () {} }
}

const mockDS = {
  config: {
    serverName: `server_${Math.round(Math.random() * 1000)}`,
  },
  services,
}

describe('http plugin', () => {
  let httpPlugin
  const apiKey = '9x5xfdxa-xxxx-4efe-a342-xxxxxxxxxxxx'
  const postUrl = `http://127.0.0.1:8888/api/v1/${apiKey}`

  before(() => {
    httpPlugin = new ConnectionEndpoint(conf, services as never as DeepstreamServices, {} as never as InternalDeepstreamConfig)
    httpPlugin.setDeepstream(mockDS)
    httpPlugin.init()
  })

  const message = Object.freeze({
    token: 'fiwueeb-3942jjh3jh23i4h23i4h2',
    body: [
      {
        topic: 'record',
        action: 'write',
        recordName: 'car/bmw',
        data: { tyres : 2 }
      },
      {
        topic: 'record',
        action: 'write',
        recordName: 'car/bmw',
        path: 'tyres',
        data: 3
      },
      {
        topic: 'rpc',
        action: 'make',
        rpcName: 'add-two',
        data: { numA: 6, numB: 3 }
      },
      {
        topic: 'event',
        action: 'emit',
        eventName: 'time',
        data: 1494343585338
      }
    ]
  })

  describe('POST endpoint', () => {
    it('should reject a request with an empty path', (done) => {
      needle.post('127.0.0.1:8888', message, { json: true }, (err, response) => {
        expect(err).to.equal(null)
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.headers['content-type']).to.match(/^text\/plain/)
        expect(response.body).to.match(/not found/i)
        done()
      })
    })

    it('should reject a request with a url-encoded payload', (done) => {
      needle.post(postUrl, message, { json: false }, (err, response) => {
        expect(err).to.equal(null)
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.headers['content-type']).to.match(/^text\/plain/)
        expect(response.body).to.match(/media type/i)
        done()
      })
    })

    it('should reject a request with a non-object payload', () => Promise.all([
      123,
      ['a', 2, 3.5],
      'foo',
      null,
      ''
    ].map((payload) => needle.postAsync(postUrl, payload, { json: true })
      .then((response) => {
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.headers['content-type']).to.match(/^text\/plain/)
        expect(response.body).to.match(/(fail|invalid)/i, JSON.stringify(payload))
      })
    )))

    it('should accept a request without an auth token', (done) => {
      const noToken = Object.assign({}, message, { token: undefined })
      needle.post(postUrl, noToken, { json: true }, (err, response) => {
        expect(err).to.equal(null)
        expect(response.statusCode).to.equal(200)
        done()
      })
    })

    it('should return an unsuccessful result for an empty list of messages', (done) => {
      needle.post(postUrl, { token: 'foo', body: [] }, { json: true }, (err, response) => {
        expect(err).to.equal(null)
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.body).to.match(/body.*must be a non-empty array/)
        done()
      })
    })

    it('should not return an error for a list of valid messages', (done) => {
      needle.post(postUrl, message, { json: true }, (err) => {
        expect(err).to.equal(null)
        done()
      })
    })

    it('should reject a request that has a mix of valid and invalid messages', (done) => {
      const someValid = message.body.slice(0, 2)
      const req = {
        token: 'foo',
        body: someValid.concat([{ pas: 'valide' } as any])
      }
      needle.post(postUrl, req, { json: true }, (err, response) => {
        expect(err).to.equal(null)
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.body).to.match(/failed to parse .* index 2/i)
        done()
      })
    })

    describe.skip('authentication', () => {
      it('should reject a request that times out', (done) => {
        needle.post(postUrl, message, { json: true }, (err, response) => {
          expect(err).to.equal(null)
          const resp = response.body
          expect(resp.result).to.equal('FAILURE')
          expect(resp.body[0].success).to.equal(false)
          expect(resp.body[0].errorTopic).to.equal('connection')
          expect(resp.body[0].errorEvent).to.equal(C.EVENT.TIMEOUT)
          done()
        })
      })

    })
  })
})
