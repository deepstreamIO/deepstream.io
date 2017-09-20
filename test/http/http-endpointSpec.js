'use strict'

/* global describe, beforeAll, afterAll, it */
/* eslint-disable no-unused-expressions, import/no-extraneous-dependencies */
const chai = require('chai') // eslint-disable-line
const proxyquire = require('proxyquire') // eslint-disable-line
const sinon = require('sinon') // eslint-disable-line
const Promise = require('bluebird')

const expect = chai.expect

const needle = require('needle')
/*
 *const http = require('http')
 *const url = require('url')
 */

const constants = require('../../src/constants/constants')
const MessageBuilder = require('../../src/message/message-builder')
const MessageParser = require('../../src/message/message-parser')
const LoggerMock = require('../mocks/logger-mock')

Promise.promisifyAll(needle)

const ConnectionEndpoint = require('../../src/message/http/connection-endpoint')

const conf = {
  healthCheckPath: '/health-check',
  enableAuthEndpoint: true,
  authPath: '/api/v1/auth',
  postPath: '/api/v1',
  getPath: '/api/v1',
  port: 8888,
  host: '127.0.0.1',
  allowAllOrigins: true,
  requestTimeout: 30
}
const mockDS = {
  _options: {
    serverName: `server_${Math.round(Math.random() * 1000)}`,
    logger: new LoggerMock(),
    authenticationHandler: { isValidUser (headers, authData, callback) { callback(true, {}) } },
    permissionHandler: { canPerformAction (user, message, callback/* , authData */) {
      callback(null, true)
    } }
  },
  constants,
  toTyped: MessageBuilder.typed,
  convertTyped: MessageParser.convertTyped,
  _messageBuilder: MessageBuilder,
  _messageDistributor: { distribute () {} }
}

describe('http plugin', () => {
  let httpPlugin
  const apiKey = '9x5xfdxa-xxxx-4efe-a342-xxxxxxxxxxxx'
  const postUrl = `http://127.0.0.1:8888/api/v1/${apiKey}`

  beforeAll(() => {
    httpPlugin = new ConnectionEndpoint(conf)
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
        expect(err).to.be.null
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.headers['content-type']).to.match(/^text\/plain/)
        expect(response.body).to.match(/not found/i)
        done()
      })
    })

    it('should reject a request with a url-encoded payload', (done) => {
      needle.post(postUrl, message, { json: false }, (err, response) => {
        expect(err).to.be.null
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
    ].map(payload => needle.postAsync(postUrl, payload, { json: true })
      .then((response) => {
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.headers['content-type']).to.match(/^text\/plain/)
        expect(response.body).to.match(/(fail|invalid)/i, payload)
      })
    )))

    it('should accept a request without an auth token', (done) => {
      const noToken = Object.assign({}, message, { token: undefined })
      needle.post(postUrl, noToken, { json: true }, (err, response) => {
        expect(err).to.be.null
        expect(response.statusCode).to.equal(200)
        done()
      })
    })

    it('should return an unsuccessful result for an empty list of messages', (done) => {
      needle.post(postUrl, { token: 'foo', body: [] }, { json: true }, (err, response) => {
        expect(err).to.be.null
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.body).to.match(/body.*must be a non-empty array/)
        done()
      })
    })

    it('should not return an error for a list of valid messages', (done) => {
      needle.post(postUrl, message, { json: true }, (err) => {
        expect(err).to.be.null
        done()
      })
    })

    it('should reject a request that has a mix of valid and invalid messages', (done) => {
      const someValid = message.body.slice(0, 2)
      const req = {
        token: 'foo',
        body: someValid.concat([{ pas: 'valide' }])
      }
      needle.post(postUrl, req, { json: true }, (err, response) => {
        expect(err).to.be.null
        expect(response.statusCode).to.be.within(400, 499)
        expect(response.body).to.match(/failed to parse .* index 2/i)
        done()
      })
    })

    describe('authentication', () => {
      let canPerformActionStub // eslint-disable-line
      beforeAll(() => {
        canPerformActionStub = sinon.stub(mockDS._options.permissionHandler, 'canPerformAction')
      })

      afterAll(() => {
        mockDS._options.permissionHandler.canPerformAction.restore()
      })

      it('should reject a request that times out', (done) => {
        needle.post(postUrl, message, { json: true }, (err, response) => {
          expect(err).to.be.null
          const resp = response.body
          expect(resp.result).to.equal('FAILURE')
          expect(resp.body[0].success).to.be.false
          expect(resp.body[0].errorTopic).to.equal('connection')
          expect(resp.body[0].errorEvent).to.equal('TIMEOUT')
          done()
        })
      })

    })
  })
})
