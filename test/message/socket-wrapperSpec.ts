import * as uwsMock from '../test-mocks/uws-mock'
const proxyquire = require('proxyquire').noPreserveCache()

const SocketWrapperFactory = proxyquire('../../src/message/uws/socket-wrapper-factory', {
  uws: uwsMock
})

describe('uws socket-wrapper creates a unified interface for sockets', () => {
  let socketWrapper

  const handshakeData = {
    headers: { referer: 'some-referer' },
    referer: 'some-referer',
    remoteAddress: 'some-address'
  }

  it('creates a SocketWrapper', () => {
    socketWrapper = SocketWrapperFactory.createSocketWrapper({}, handshakeData, {})
    expect(socketWrapper.getHandshakeData()).toEqual({
      headers: { referer: 'some-referer' },
      referer: 'some-referer',
      remoteAddress: 'some-address'
    })
  })

  it('handshake data is able to be queried for again', () => {
    expect(socketWrapper.getHandshakeData()).toEqual({
      headers: { referer: 'some-referer' },
      referer: 'some-referer',
      remoteAddress: 'some-address'
    })
  })
})
