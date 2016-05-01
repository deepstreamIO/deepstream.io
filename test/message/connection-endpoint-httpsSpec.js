var proxyquire = require( 'proxyquire' ).noCallThru(),
	engineIoMock = require( '../mocks/engine-io-mock' ),
	HttpMock = require( '../mocks/http-mock' ),
	httpMock = new HttpMock(),
	httpsMock = new HttpMock(),
	ConnectionEndpoint = proxyquire( '../../src/message/connection-endpoint', { 'engine.io': engineIoMock, 'http': httpMock, 'https': httpsMock } ),
	_msg = require( '../test-helper/test-helper' ).msg,
	permissionHandlerMock = require( '../mocks/permission-handler-mock' ),
	lastAuthenticatedMessage = null,
	lastLoggedMessage = null,
	socketMock,
	options,
	noop = function(){},
	connectionEndpoint;

options = {
	permissionHandler: require( '../mocks/permission-handler-mock' ),
	logger: { log: function( logLevel, event, msg ){ lastLoggedMessage = msg; } },
	maxAuthAttempts: 3,
	logInvalidAuthData: true,
	tcpServerEnabled: false,
	webServerEnabled: true
};

describe( 'validates HTTPS server conditions', function() {

	var options = null;
	var error = null;
	var connectionEndpointValidation = null;

	beforeEach(function() {
		sslOptions = {
			permissionHandler: require( '../mocks/permission-handler-mock' ),
			logger: { log: function( logLevel, event, msg ){} },
			tcpServerEnabled: false,
			webServerEnabled: true
		};

		spyOn(httpMock, 'createServer').and.callThrough();
		spyOn(httpsMock, 'createServer').and.callThrough();
	});

	it( 'creates a http connection when sslKey and sslCert are not provided', function(){
		connectionEndpointValidation = new ConnectionEndpoint( sslOptions, noop );
		expect(httpMock.createServer).toHaveBeenCalledWith();
		expect(httpsMock.createServer).not.toHaveBeenCalled();
	});

	it( 'creates a https connection when sslKey and sslCert are provided', function(){
		sslOptions.sslKey = 'sslPrivateKey';
		sslOptions.sslCert = 'sslCertificate';
		connectionEndpointValidation = new ConnectionEndpoint( sslOptions, noop );
		expect(httpMock.createServer).not.toHaveBeenCalled();
		expect(httpsMock.createServer).toHaveBeenCalledWith( { "key": "sslPrivateKey", "cert": "sslCertificate"} );
	});

	it( 'creates a https connection when sslKey, sslCert and sslCa are provided', function(){
		sslOptions.sslKey = 'sslPrivateKey';
		sslOptions.sslCert = 'sslCertificate';
		sslOptions.sslCa = 'sslCertificateAuthority';
		connectionEndpointValidation = new ConnectionEndpoint( sslOptions, noop );
		expect(httpMock.createServer).not.toHaveBeenCalled();
		expect(httpsMock.createServer).toHaveBeenCalledWith( { "key": "sslPrivateKey", "cert": "sslCertificate", "ca": "sslCertificateAuthority"} );
	});

	it( 'throws an exception when only sslCert is provided', function(){
		try {
			sslOptions.sslCert = 'sslCertificate';
			connectionEndpointValidation = new ConnectionEndpoint( sslOptions, noop );
		} catch( e ) {
			error = e;
		} finally {
			expect( error.message ).toBe( 'Must also include sslKey in order to use HTTPS' );
		}
	});

	it( 'throws an exception when only sslKey is provided', function(){
		try {
			sslOptions.sslKey = "sslPrivateKey";
			connectionEndpointValidation = new ConnectionEndpoint( sslOptions, noop );
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
			connectionEndpointValidation = new ConnectionEndpoint( sslOptions, noop );
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
			connectionEndpointValidation = new ConnectionEndpoint( sslOptions, noop );
		} catch( e ) {
			error = e;
		} finally {
			expect( error.message ).toBe( 'Must also include sslCert in order to use HTTPS' );
		}
	});
});