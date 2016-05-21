var AuthenticationHandler = require( '../../src/authentication/file-based-authentication-handler' );

describe( 'it loads basic user file with hashed passwords', function(){
	var authenticationHandler;
	var settings = {
		path: './test/test-configs/users.json',
		hash: 'md5',
		iterations: 100,
		keyLength: 32,
		watch: false
	};

	it( 'creates the authentication handler', function( done ){
		authenticationHandler = new AuthenticationHandler( settings );
		authenticationHandler.on( 'ready', done );
	});

	it( 'confirms userA with valid password', function( done ){
		var authData = {
			username: 'userA',
			password: 'userAPass'
		};

		var callback = function( error, result ) {
			expect( error ).toBe( null );
			expect( result ).toBe( true );
			done();
		};

		authenticationHandler.isValidUser( null, authData, callback );
	});
})