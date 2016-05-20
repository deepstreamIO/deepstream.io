var AuthenticationHandler = require( '../../src/authentication/file-based-authentication-handler' );

describe( 'it loads basic user files', function(){
	var authenticationHandler;
	var settings = {
		path: './test/test-configs/users.json',
		hashAlgo: 'md5',
		iterations: 100,
		keyLength: 32,
		watch: false
	};

	it( 'creates the authentication handler', function(){
		authenticationHandler = new AuthenticationHandler( settings );
	})
})