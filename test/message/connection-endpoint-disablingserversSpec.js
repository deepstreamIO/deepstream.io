var proxyquire = require( 'proxyquire' ).noCallThru(),
	engineIoMock = require( '../mocks/engine-io-mock' ),
	HttpMock = require( '../mocks/http-mock' ),
	httpMock = new HttpMock(),
	httpsMock = new HttpMock(),
	ConnectionEndpoint = proxyquire( '../../src/message/connection-endpoint', { 'engine.io': engineIoMock, 'http': httpMock, 'https': httpsMock } ),
	_msg = require( '../test-helper/test-helper' ).msg,
	permissionHandlerMock = require( '../mocks/permission-handler-mock' ),
	authenticationHandlerMock = require( '../mocks/authentication-handler-mock' ),
	socketMock,
	options,
	noop = function(){},
	connectionEndpoint;

var otherOptions = {
	permissionHandler: permissionHandlerMock,
	authenticationHandler: authenticationHandlerMock,
	logger: { log: jasmine.createSpy( 'log' ) },
	tcpPort: 6021
};

describe( 'disabling tcp or webserver endpoints', function() {

	it( 'resets permission handler mock', function() {
		permissionHandlerMock.reset();
	} );

	describe( 'disabled http server', function() {
		it( 'creates a connectionEndpoint with a disabled web server', function(  ) {
			otherOptions.webServerEnabled = false;
			otherOptions.tcpServerEnabled = true;
			connectionEndpoint = new ConnectionEndpoint( otherOptions, noop );
		} );

		it( 'simulates a web client connection', function(){
			socketMock = engineIoMock.simulateConnection();
			expect( socketMock.lastSendMessage ).toBe( null );
		});

		it( 'handles auth messages correctly', function() {
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( null ); //Since it is disabled
		});

		describe( 'closes all client connections on close', function(){
			it( 'calls close on connections', function( done ) {
				var closeSpy = jasmine.createSpy( 'close-event' );
				connectionEndpoint.on( 'close', closeSpy );
				connectionEndpoint.close();

				setTimeout( function() {
					expect( closeSpy ).toHaveBeenCalled();
					done();
				}, 0 );
			} );
		});
	});

	describe( 'disabled tcp server', function() {
		it( 'creates a connectionEndpoint with a disabled TCP server', function() {
			otherOptions.webServerEnabled = true;
			otherOptions.tcpServerEnabled = false;
			connectionEndpoint = new ConnectionEndpoint( otherOptions, noop );
		} );

		it( 'simulates a client connection', function(){
			socketMock = engineIoMock.simulateConnection();
			expect( socketMock.lastSendMessage ).toBe( _msg( 'C|A+' ) );
		});

		it( 'handles auth messages correctly', function() {
			socketMock.emit( 'message', _msg( 'A|REQ|{"user":"wolfram"}+' ) );
			expect( socketMock.lastSendMessage ).toBe( _msg( 'A|A+' ) );
		});

		describe( 'closes all client connections on close', function(){
			it( 'calls close on connections', function( done ) {
				var closeSpy = jasmine.createSpy( 'close-event' );
				connectionEndpoint.on( 'close', closeSpy );
				connectionEndpoint.close();

				setTimeout( function() {
					expect( closeSpy ).toHaveBeenCalled();
					done();
				}, 0 );
			} );
		});
	});


	describe( 'disabled both servers', function() {

		it( 'creates a connectionEndpoint with a disabled web server', function() {
			otherOptions.webServerEnabled = false;
			otherOptions.tcpServerEnabled = false;

			expect( function() {
				connectionEndpoint = new ConnectionEndpoint( otherOptions, noop );
			} ).toThrow( new Error( 'Can\'t start deepstream with both webserver and tcp disabled' ) );
		} );
	});

	describe( 'already listening', function() {

		it( 'it creates a connectionEndpoint with a server that\'s already listening', function() {
			otherOptions.webServerEnabled = true;
			otherOptions.tcpServerEnabled = false;
			httpMock.nextServerIsListening = true;
			otherOptions.logger.log.calls.reset();

			connectionEndpoint = new ConnectionEndpoint( otherOptions, noop );
			expect( otherOptions.logger.log ).toHaveBeenCalledWith( 1, 'INFO', 'Listening for browser connections on undefined:undefined' );
		} );
	});
});