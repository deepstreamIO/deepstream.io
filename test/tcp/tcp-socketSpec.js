var TcpSocket = require( '../../src/tcp/tcp-socket' );
var net = require( 'net' );
var msg = require( '../test-helper/test-helper' ).msg;

describe( 'wraps the native net.Socket', function(){
	var tcpSocket ;
	var netSocket;
	var onMessage = jasmine.createSpy( 'message' );
	var onClose = jasmine.createSpy( 'close' );
	var options = {
		logger: { log: jasmine.createSpy( 'log' ) },
		maxMessageSize: 64
	};

	it( 'creates the socket', function(){
		netSocket = new net.Socket();
		netSocket.write = jasmine.createSpy( 'write' );
		tcpSocket = new TcpSocket( options, netSocket );
		tcpSocket.on( 'message', onMessage );
		tcpSocket.on( 'close', onClose );

		//making sure we're dealing with an unconnected socket
		expect( netSocket.address() ).toEqual({});
		expect( tcpSocket.remoteAddress ).toBe( 'undefined:undefined' );
	});

	it( 'sends some data on the socket', function(){
		tcpSocket.send( 'msg1' );
		expect( netSocket.write ).toHaveBeenCalledWith( 'msg1', 'utf8' );
	});

	it( 'receives some data', function(){
		expect( onMessage ).not.toHaveBeenCalled();
		netSocket.emit( 'data', msg( 'a+' ));
		expect( onMessage ).toHaveBeenCalledWith( msg( 'a+' ) );
	});

	it( 'receives a non-string value from the socket', function(){
		netSocket.emit( 'data', null );
		expect( options.logger.log ).toHaveBeenCalledWith(   2, 'INVALID_MESSAGE', 'Received non-string message from socket' );
	});

	it( 'closes the net socket', function(){
		expect( onClose ).not.toHaveBeenCalled();
		netSocket.emit( 'end' );
		expect( onClose ).toHaveBeenCalled();
	});

	it( 'copes with multiple close events', function(){
		netSocket.emit( 'end' );
		expect( onClose.calls.count() ).toBe( 1 );
	});

	it( 'logs messages from half closed sockets', function(){
		netSocket.emit( 'data', msg( 'b+' ));
		expect( onMessage.calls.count() ).toBe( 1 );
		expect( options.logger.log ).toHaveBeenCalledWith(  2, 'CLOSED_SOCKET_INTERACTION', 'Received data on a half closed socket: ' + msg( 'b+' ) );
	});

	it( 'tries to send messages on a closed socket', function(){
		tcpSocket.send( 'msg2' );
		expect( netSocket.write.calls.count() ).toBe( 1 );
		expect( options.logger.log ).toHaveBeenCalledWith(  3, 'CLOSED_SOCKET_INTERACTION', 'Attempt to send message on closed socket: msg2' );
	});
});

describe( 'closes the socket from the server side', function(){
	var tcpSocket ;
	var netSocket;
	var onMessage = jasmine.createSpy( 'message' );
	var onClose = jasmine.createSpy( 'close' );
	var options = {
		logger: { log: jasmine.createSpy( 'log' ) },
		maxMessageSize: 64
	};

	it( 'creates the socket', function(){
		netSocket = new net.Socket();
		netSocket.write = jasmine.createSpy( 'write' );
		netSocket.end = jasmine.createSpy( 'end' );
		tcpSocket = new TcpSocket( options, netSocket );
		tcpSocket.on( 'message', onMessage );
		tcpSocket.on( 'close', onClose );

		//making sure we're dealing with an unconnected socket
		expect( netSocket.address() ).toEqual({});
		expect( tcpSocket.remoteAddress ).toBe( 'undefined:undefined' );
	});

	it( 'closes the socket', function(){
		expect( netSocket.end ).not.toHaveBeenCalled();
		tcpSocket.close();
		expect( netSocket.end ).toHaveBeenCalled();
	});
});

describe( 'closes the socket on error', function(){
	var tcpSocket ;
	var netSocket;
	var onMessage = jasmine.createSpy( 'message' );
	var onClose = jasmine.createSpy( 'close' );
	var options = {
		logger: { log: jasmine.createSpy( 'log' ) },
		maxMessageSize: 64
	};

	it( 'creates the socket', function(){
		netSocket = new net.Socket();
		netSocket.write = jasmine.createSpy( 'write' );
		netSocket.end = jasmine.createSpy( 'end' );
		tcpSocket = new TcpSocket( options, netSocket );
		tcpSocket.on( 'message', onMessage );
		tcpSocket.on( 'close', onClose );

		//making sure we're dealing with an unconnected socket
		expect( netSocket.address() ).toEqual({});
		expect( tcpSocket.remoteAddress ).toBe( 'undefined:undefined' );
	});

	it( 'encounters an error', function(){
		expect( onClose ).not.toHaveBeenCalled();
		netSocket.emit( 'error', 'some-error' );
		expect( onClose ).toHaveBeenCalled();
	});
});