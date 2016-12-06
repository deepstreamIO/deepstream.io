var SocketMock = require( '../mocks/socket-mock' );
var SocketWrapper = require( '../../src/message/socket-wrapper' );

describe( 'socket-wrapper creates a unified interface for sockets', function(){
	var socket = new SocketMock(),
		socketWrapper;
	socket._socket.remoteAddress = 'some-address';
	socket.upgradeReq = {
		headers: {
			referer: 'some-referer'
		}
	};

	it( 'creates a SocketWrapper', function(){
		socketWrapper = new SocketWrapper( socket, {} );
		expect( socketWrapper.getHandshakeData() ).toEqual({
			headers: { referer: 'some-referer' },
			referer: 'some-referer',
			remoteAddress: 'some-address'
		});
	});

	it( 'handshake data is able to be queried for again', function() {
		expect( socketWrapper.getHandshakeData() ).toEqual({
			headers: { referer: 'some-referer' },
			referer: 'some-referer',
			remoteAddress: 'some-address'
		});
	});
});