/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let proxyquire = require('proxyquire').noCallThru(),
  websocketMock = require('../mocks/websocket-mock'),
  HttpMock = require('../mocks/http-mock'),
  httpMock = new HttpMock(),
  httpsMock = new HttpMock(),
  ConnectionEndpoint = proxyquire('../../src/message/connection-endpoint', {
    uws: websocketMock,
    http: httpMock,
    https: httpsMock
  }),
  _msg = require('../test-helper/test-helper').msg,
  permissionHandlerMock = require('../mocks/permission-handler-mock'),
  lastAuthenticatedMessage = null,
  lastLoggedMessage = null,
  socketMock,
  onReady = function () { ready = true },
  connectionEndpoint,
  ready = false,
  sslOptions

let options = {
  permissionHandler: require('../mocks/permission-handler-mock'),
  logger: { log(logLevel, event, msg) { lastLoggedMessage = msg } },
  maxAuthAttempts: 3,
  logInvalidAuthData: true
}

describe('validates HTTPS server conditions', () => {
  const options = null
  let error = null
  let connectionEndpointValidation = null

  beforeEach(() => {
    sslOptions = {
      permissionHandler: require('../mocks/permission-handler-mock'),
      logger: { log(logLevel, event, msg) {} }
    }

    spyOn(httpMock, 'createServer').and.callThrough()
    spyOn(httpsMock, 'createServer').and.callThrough()
  })


  afterEach((done) => {
    if (ready || !connectionEndpointValidation) {
      ready = false
      done()
    } else {
      connectionEndpointValidation.once('close', done)
      connectionEndpointValidation.close()
    }
  })

  it('creates a http connection when sslKey and sslCert are not provided', () => {
    connectionEndpointValidation = new ConnectionEndpoint(sslOptions, onReady)
    expect(httpMock.createServer).toHaveBeenCalledWith()
    expect(httpsMock.createServer).not.toHaveBeenCalled()
  })

  it('creates a https connection when sslKey and sslCert are provided', () => {
    sslOptions.sslKey = 'sslPrivateKey'
    sslOptions.sslCert = 'sslCertificate'
    connectionEndpointValidation = new ConnectionEndpoint(sslOptions, onReady)
    expect(httpMock.createServer).not.toHaveBeenCalled()
    expect(httpsMock.createServer).toHaveBeenCalledWith({ key: 'sslPrivateKey', cert: 'sslCertificate' })
  })

  it('creates a https connection when sslKey, sslCert and sslCa are provided', () => {
    sslOptions.sslKey = 'sslPrivateKey'
    sslOptions.sslCert = 'sslCertificate'
    sslOptions.sslCa = 'sslCertificateAuthority'
    connectionEndpointValidation = new ConnectionEndpoint(sslOptions, onReady)
    expect(httpMock.createServer).not.toHaveBeenCalled()
    expect(httpsMock.createServer).toHaveBeenCalledWith({ key: 'sslPrivateKey', cert: 'sslCertificate', ca: 'sslCertificateAuthority' })
  })

  it('throws an exception when only sslCert is provided', () => {
    try {
      sslOptions.sslCert = 'sslCertificate'
      connectionEndpointValidation = new ConnectionEndpoint(sslOptions, onReady)
    } catch (e) {
      error = e
    } finally {
      expect(error.message).toBe('Must also include sslKey in order to use HTTPS')
    }
  })

  it('throws an exception when only sslKey is provided', () => {
    try {
      sslOptions.sslKey = 'sslPrivateKey'
      connectionEndpointValidation = new ConnectionEndpoint(sslOptions, onReady)
    } catch (e) {
      error = e
    } finally {
      expect(error.message).toBe('Must also include sslCert in order to use HTTPS')
    }
  })

  it('throws an exception when sslCert and sslCa is provided', () => {
    try {
      sslOptions.sslCert = 'sslCertificate'
      sslOptions.sslCa = 'sslCertificateAuthority'
      connectionEndpointValidation = new ConnectionEndpoint(sslOptions, onReady)
    } catch (e) {
      error = e
    } finally {
      expect(error.message).toBe('Must also include sslKey in order to use HTTPS')
    }
  })

  it('throws an exception when sslKey and sslCa is provided', () => {
    try {
      sslOptions.sslKey = 'sslPrivateKey'
      sslOptions.sslCa = 'sslCertificateAuthority'
      connectionEndpointValidation = new ConnectionEndpoint(sslOptions, onReady)
    } catch (e) {
      error = e
    } finally {
      expect(error.message).toBe('Must also include sslCert in order to use HTTPS')
    }
  })
})
