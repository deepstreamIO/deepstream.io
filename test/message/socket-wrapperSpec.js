/* eslint-disable import/no-extraneous-dependencies */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const proxyquire = require('proxyquire').noPreserveCache()
const uwsMock = require('../mocks/uws-mock')

const SocketWrapper = proxyquire('../../src/message/uws/socket-wrapper', {
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
    socketWrapper = new SocketWrapper({}, handshakeData, {})
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
