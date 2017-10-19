const proxyquire = require('proxyquire').noPreserveCache()

import * as uwsMock from '../test-mocks/uws-mock'
import HttpMock from '../test-mocks/http-mock'
import LoggerMock from '../test-mocks/logger-mock'
import PermissionHandlerMock from '../test-mocks/permission-handler-mock'

const httpMock = new HttpMock()
const httpsMock = new HttpMock()
// since proxyquire.callThru is enabled, manually capture members from prototypes
httpMock.createServer = httpMock.createServer
httpsMock.createServer = httpsMock.createServer
const ConnectionEndpoint = proxyquire('../../src/message/uws/connection-endpoint', {
  uws: uwsMock,
  http: httpMock,
  https: httpsMock
}).default

const config = {
  maxAuthAttempts: 3,
  logInvalidAuthData: true
}

const services = {
  permissionHandler: PermissionHandlerMock,
  logger: new LoggerMock()
}

const mockDs = { config, services }

let connectionEndpoint

const connectionEndpointInit = (endpointOptions, onReady) => {
  connectionEndpoint = new ConnectionEndpoint(endpointOptions)
  connectionEndpoint.setDeepstream(mockDs)
  connectionEndpoint.init()
  connectionEndpoint.on('ready', onReady)
}

describe('validates HTTPS server conditions', () => {
  let error
  let sslOptions
  connectionEndpoint = null

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
    if (!connectionEndpoint || !connectionEndpoint.isReady) {
      done()
    } else {
      connectionEndpoint.once('close', done)
      connectionEndpoint.close()
    }
    (httpMock.createServer as any).calls.reset()
    (httpsMock.createServer as any).calls.reset()
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
      expect(httpsMock.createServer).toHaveBeenCalledWith({ key: 'sslPrivateKey', cert: 'sslCertificate', ca: undefined })
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
