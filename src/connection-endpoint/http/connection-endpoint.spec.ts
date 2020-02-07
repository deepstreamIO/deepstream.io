import { expect } from 'chai'
import * as needle from 'needle'

import LoggerMock from '../../test/mock/logger-mock'
import { DeepstreamServices, DeepstreamConfig } from '@deepstream/types';
import { OpenAuthentication } from '../../services/authentication/open/open-authentication';
import { OpenPermission } from '../../services/permission/open/open-permission';
import { NodeHTTP } from '../../services/http/node/node-http'
import { HTTPConnectionEndpoint } from './connection-endpoint';

const conf = {
  authPath: '/api/v1/auth',
  postPath: '/api/v1',
  getPath: '/api/v1',
  enableAuthEndpoint: true,
  requestTimeout: 30,
  allowAuthData: true
}

const services: any = {
  logger: new LoggerMock(),
  authentication: new OpenAuthentication(),
  permission: new OpenPermission(),
  messageDistributor: { distribute () {} }
}
services.httpService = new NodeHTTP({
  port: 9898,
  host: '127.0.0.1',
  allowAllOrigins: true,
  healthCheckPath: '/health-check',
  maxMessageSize: 100000,
  hostUrl: '',
  headers: []
}, services as DeepstreamServices, {} as DeepstreamConfig)

describe.skip('http plugin', () => {
  let httpConnectionEndpoint
  const postUrl = 'http://127.0.0.1:9898/api/v1/'

  before(async () => {
    httpConnectionEndpoint = new HTTPConnectionEndpoint(conf, services as never as DeepstreamServices, {} as never as DeepstreamConfig)
    httpConnectionEndpoint.init()
    await httpConnectionEndpoint.whenReady()
  })

  after(async () => {
    await services.httpService.close()
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
      needle.post('127.0.0.1:9898', message, { json: true }, (err, response) => {
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
      '123',
      ['a', '2', '3.5'],
      'foo',
      null,
      ''
    ].map((payload) => needle('post', postUrl, payload, { json: true })
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
      it('should reject a request that times out', async () => {
        const response = await needle('post', postUrl, message, { json: true })
        const resp = response.body
        expect(resp.result).to.equal('FAILURE')
        expect(resp.body[0].success).to.equal(false)
        expect(resp.body[0].errorTopic).to.equal('connection')
        expect(resp.body[0].errorEvent).to.equal('TIME')
      })
    })
  })
})
