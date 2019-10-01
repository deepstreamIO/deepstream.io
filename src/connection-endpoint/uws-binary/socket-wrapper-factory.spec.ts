// import { expect } from 'chai'
// import {createUWSSocketWrapper} from './socket-wrapper-factory'
//
// describe.skip('uws socket-wrapper creates a unified interface for sockets', () => {
//   let socketWrapper
//
//   const handshakeData = {
//     headers: { referer: 'some-referer' },
//     referer: 'some-referer',
//     remoteAddress: 'some-address'
//   }
//
//   it('creates a SocketWrapper', () => {
//     socketWrapper = createUWSSocketWrapper({}, handshakeData)
//     expect(socketWrapper.getHandshakeData()).to.deep.equal({
//       headers: { referer: 'some-referer' },
//       referer: 'some-referer',
//       remoteAddress: 'some-address'
//     })
//   })
//
//   it('handshake data is able to be queried for again', () => {
//     expect(socketWrapper.getHandshakeData()).to.deep.equal({
//       headers: { referer: 'some-referer' },
//       referer: 'some-referer',
//       remoteAddress: 'some-address'
//     })
//   })
// })
