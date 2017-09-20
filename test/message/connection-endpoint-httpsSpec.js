/* eslint-disable import/no-extraneous-dependencies */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach, beforeAll */
'use strict'

const proxyquire = require('proxyquire').noPreserveCache()
const uwsMock = require('../mocks/uws-mock')
const HttpMock = require('../mocks/http-mock')
const LoggerMock = require('../mocks/logger-mock')
const PermissionHandlerMock = require('../mocks/permission-handler-mock')

const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer
const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
  uws: uwsMock,
  http: httpMock,
  https: httpsMock
})

const options = {
  permissionHandler: PermissionHandlerMock,
  logger: new LoggerMock(),
  maxAuthAttempts: 3,
  logInvalidAuthData: true
}

const mockDs = { _options: options }

const connectionEndpointInit = (endpointOptions, onReady) => {
  options.connectionEndpoint = new ConnectionEndpoint(endpointOptions)
  options.connectionEndpoint.setDeepstream(mockDs)
  options.connectionEndpoint.init()
  options.connectionEndpoint.on('ready', onReady)
}

describe('validates HTTPS server conditions', () => {
  let error
  let sslOptions
  options.connectionEndpoint = null

  beforeAll(() => {
    spyOn(httpMock, 'createServer').and.callThrough()
    spyOn(httpsMock, 'createServer').and.callThrough()
  })

  beforeEach(() => {
    sslOptions = {
      permissionHandler: PermissionHandlerMock,
      logger: { log () {} }
    }
    error = { message: null }
  })

  afterEach((done) => {
    if (!options.connectionEndpoint || !options.connectionEndpoint.isReady) {
      done()
    } else {
      options.connectionEndpoint.once('close', done)
      options.connectionEndpoint.close()
    }
    httpMock.createServer.calls.reset()
    httpsMock.createServer.calls.reset()
  })

  it('creates a http connection when sslKey and sslCert are not provided', (done) => {
    connectionEndpointInit(sslOptions, () => {
      expect(httpMock.createServer).toHaveBeenCalledWith()
      expect(httpsMock.createServer).not.toHaveBeenCalled()
      done()
    })
  })

  it('creates a https connection when sslKey and sslCert are provided', (done) => {
    sslOptions.sslKey = 'sslPrivateKey'
    sslOptions.sslCert = 'sslCertificate'
    connectionEndpointInit(sslOptions, () => {
      expect(httpMock.createServer).not.toHaveBeenCalled()
      expect(httpsMock.createServer).toHaveBeenCalledWith({ key: 'sslPrivateKey', cert: 'sslCertificate' })
      done()
    })
  })

  it('creates a https connection when sslKey, sslCert and sslCa are provided', (done) => {
    sslOptions.sslKey = 'sslPrivateKey'
    sslOptions.sslCert = 'sslCertificate'
    sslOptions.sslCa = 'sslCertificateAuthority'
    connectionEndpointInit(sslOptions, () => {
      expect(httpMock.createServer).not.toHaveBeenCalled()
      expect(httpsMock.createServer).toHaveBeenCalledWith({ key: 'sslPrivateKey', cert: 'sslCertificate', ca: 'sslCertificateAuthority' })
      done()
    })
  })

  it('throws an exception when only sslCert is provided', () => {
    try {
      sslOptions.sslCert = 'sslCertificate'
      connectionEndpointInit(sslOptions, () => {})
    } catch (e) {
      error = e
    } finally {
      expect(error.message).toBe('Must also include sslKey in order to use HTTPS')
    }
  })

  it('throws an exception when only sslKey is provided', () => {
    try {
      sslOptions.sslKey = 'sslPrivateKey'
      connectionEndpointInit(sslOptions, () => {})
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
      connectionEndpointInit(sslOptions, () => {})
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
      connectionEndpointInit(sslOptions, () => {})
    } catch (e) {
      error = e
    } finally {
      expect(error.message).toBe('Must also include sslCert in order to use HTTPS')
    }
  })
})
