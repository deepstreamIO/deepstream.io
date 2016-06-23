var proxyquire = require( 'proxyquire' ).noCallThru(),
	engineIoMock = require( '../mocks/engine-io-mock' ),
	HttpMock = require( '../mocks/http-mock' ),
	httpMock = new HttpMock(),
	httpsMock = new HttpMock(),
	TcpEndpointMock = require( '../mocks/tcp-endpoint-mock' ),
	ConnectionEndpoint = proxyquire( '../../src/message/connection-endpoint', {
		'engine.io': engineIoMock,
		'http': httpMock,
		'https': httpsMock,
		'../tcp/tcp-endpoint': TcpEndpointMock
	} ),
	_msg = require( '../test-helper/test-helper' ).msg,
	permissionHandlerMock = require( '../mocks/permission-handler-mock' ),
	lastAuthenticatedMessage = null,
	lastLoggedMessage = null,
	socketMock,
	options,
	onReady = function() { ready = true; },
	connectionEndpoint,
	ready = false;

options = {
	permissionHandler: require( '../mocks/permission-handler-mock' ),
	logger: { log: function( logLevel, event, msg ){ lastLoggedMessage = msg; } },
	maxAuthAttempts: 3,
	logInvalidAuthData: true,
	tcpServerEnabled: true,
	webServerEnabled: true,
	tcpPort: 6021
};

describe( 'validates HTTPS server conditions', function() {

	var options = null;
	var error = null;
	var connectionEndpointValidation = null;

	beforeEach(function() {
		sslOptions = {
			permissionHandler: require( '../mocks/permission-handler-mock' ),
			logger: { log: function( logLevel, event, msg ){} },
			tcpServerEnabled: true,
			webServerEnabled: true,
			tcpPort: 6021
		};

		spyOn(httpMock, 'createServer').and.callThrough();
		spyOn(httpsMock, 'createServer').and.callThrough();
	});


	afterEach( function( done ) {
		if( ready || !connectionEndpointValidation ) {
			ready = false;
			done();
		} else {
			connectionEndpointValidation.once( 'close', done );
			connectionEndpointValidation.close();
		}
	} );

	it( 'creates a http connection when sslKey and sslCert are not provided', function(){
		connectionEndpointValidation = new ConnectionEndpoint( sslOptions, onReady );
		expect(httpMock.createServer).toHaveBeenCalledWith();
		expect(httpsMock.createServer).not.toHaveBeenCalled();
	});

	it( 'creates a https connection when sslKey and sslCert are provided', function(){
		sslOptions.sslKey = 'sslPrivateKey';
		sslOptions.sslCert = 'sslCertificate';
		connectionEndpointValidation = new ConnectionEndpoint( sslOptions, onReady );
		expect(httpMock.createServer).not.toHaveBeenCalled();
		expect(httpsMock.createServer).toHaveBeenCalledWith( { "key": "sslPrivateKey", "cert": "sslCertificate"} );
	});

	it( 'creates a https connection when sslKey, sslCert and sslCa are provided', function(){
		sslOptions.sslKey = 'sslPrivateKey';
		sslOptions.sslCert = 'sslCertificate';
		sslOptions.sslCa = 'sslCertificateAuthority';
		connectionEndpointValidation = new ConnectionEndpoint( sslOptions, onReady );
		expect(httpMock.createServer).not.toHaveBeenCalled();
		expect(httpsMock.createServer).toHaveBeenCalledWith( { "key": "sslPrivateKey", "cert": "sslCertificate", "ca": "sslCertificateAuthority"} );
	});

	it( 'throws an exception when only sslCert is provided', function(){
		try {
			sslOptions.sslCert = 'sslCertificate';
			connectionEndpointValidation = new ConnectionEndpoint( sslOptions, onReady );
		} catch( e ) {
			error = e;
		} finally {
			expect( error.message ).toBe( 'Must also include sslKey in order to use HTTPS' );
		}
	});

	it( 'throws an exception when only sslKey is provided', function(){
		try {
			sslOptions.sslKey = "sslPrivateKey";
			connectionEndpointValidation = new ConnectionEndpoint( sslOptions, onReady );
		} catch( e ) {
			error = e;
		} finally {
			expect( error.message ).toBe( 'Must also include sslCert in order to use HTTPS' );
		}
	});

	it( 'throws an exception when sslCert and sslCa is provided', function(){
		try {
			sslOptions.sslCert = 'sslCertificate';
			sslOptions.sslCa = 'sslCertificateAuthority';
			connectionEndpointValidation = new ConnectionEndpoint( sslOptions, onReady );
		} catch( e ) {
			error = e;
		} finally {
			expect( error.message ).toBe( 'Must also include sslKey in order to use HTTPS' );
		}
	});

	it( 'throws an exception when sslKey and sslCa is provided', function(){
		try {
			sslOptions.sslKey = "sslPrivateKey";
			sslOptions.sslCa = 'sslCertificateAuthority';
			connectionEndpointValidation = new ConnectionEndpoint( sslOptions, onReady );
		} catch( e ) {
			error = e;
		} finally {
			expect( error.message ).toBe( 'Must also include sslCert in order to use HTTPS' );
		}
	});
});