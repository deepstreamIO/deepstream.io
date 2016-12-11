/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const SocketMock = require('../mocks/socket-mock')
const SocketWrapper = require('../../src/message/socket-wrapper')

describe('socket-wrapper creates a unified interface for sockets', () => {
  let socket = new SocketMock(),
    socketWrapper
  socket._socket.remoteAddress = 'some-address'
  socket.upgradeReq = {
    headers: {
      referer: 'some-referer'
    }
  }

  it('creates a SocketWrapper', () => {
    socketWrapper = new SocketWrapper(socket, {})
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
