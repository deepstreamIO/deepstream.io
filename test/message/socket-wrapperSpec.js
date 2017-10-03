/* eslint-disable import/no-extraneous-dependencies */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const proxyquire = require('proxyquire').noPreserveCache()
const uwsMock = require('../test-mocks/uws-mock')

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
    socketWrapper = SocketWrapperFactory.create({}, handshakeData, {})
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
