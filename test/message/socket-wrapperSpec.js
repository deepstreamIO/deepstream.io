var SocketMock = require( '../mocks/socket-mock' );
var SocketWrapper = require( '../../src/message/socket-wrapper' );

describe( 'socket-wrapper creates a unified interface for sockets', function(){
	it( 'creates a SocketWrapper', function(){
		var socket = new SocketMock();
		socket._socket.remoteAddress = 'some-address';
		socket.upgradeReq = {
			headers: {
				referer: 'some-referer'
			}
		};
		var socketWrapper = new SocketWrapper( socket, {} );
		expect( socketWrapper.getHandshakeData() ).toEqual({
			headers: { referer: 'some-referer' },
			referer: 'some-referer',
			remoteAddress: 'some-address'
		});
	});
});