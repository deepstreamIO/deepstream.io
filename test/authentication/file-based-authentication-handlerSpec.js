var AuthenticationHandler = require( '../../src/authentication/file-based-authentication-handler' );

var testAuthentication = function( settings ) {
	var authData = {
		username: settings.username,
		password: settings.password
	};

	var callback = function( result, data ) {
		expect( result ).toBe( settings.expectedResult );

		if( settings.expectedResult ) {
			expect( data ).toEqual( {
				username: settings.username,
				serverData: settings.serverData,
				clientData: settings.clientData
			} );
		} else {
			expect( data ).toBeUndefined();
		}

		settings.done();
	};

	settings.handler.isValidUser( null, authData, callback );
};

describe( 'does authentication for hashed passwords', function(){
	var authenticationHandler;
	var settings = {
		path: './test/test-configs/users-unhashed.json',
		hash: false
	};

	it( 'creates the authentication handler', function( done ){
		authenticationHandler = new AuthenticationHandler( settings );
		authenticationHandler.on( 'ready', done );
		expect( authenticationHandler.type ).toBe( 'file using ./test/test-configs/users-unhashed.json' );
	});

	it( 'confirms userC with valid password', function( done ){
		testAuthentication({
			username: 'userC',
			password: 'userCPass',
			expectedResult: true,
			serverData: null,
			clientData: null,
			done: done,
			handler: authenticationHandler
		});
	});

	it( 'rejects userC with invalid password', function( done ){
		testAuthentication({
			username: 'userC',
			password: 'userDPass',
			expectedResult: false,
			serverData: null,
			clientData: null,
			done: done,
			handler: authenticationHandler
		});
	});
});

describe( 'does authentication for hashed passwords', function(){
	var authenticationHandler;
	var settings = {
		path: './test/test-configs/users.json',
		hash: 'md5',
		iterations: 100,
		keyLength: 32
	};

	it( 'creates the authentication handler', function( done ){
		authenticationHandler = new AuthenticationHandler( settings );
		authenticationHandler.on( 'ready', done );
	});

	it( 'confirms userA with valid password', function( done ){
		testAuthentication({
			username: 'userA',
			password: 'userAPass',
			expectedResult: true,
			serverData: { "some": "values" },
			clientData: { "all": "othervalue" },
			done: done,
			handler: authenticationHandler
		});
	});

	it( 'rejects userA with an invalid password', function( done ){
		testAuthentication({
			username: 'userA',
			password: 'wrongPassword',
			expectedResult: false,
			done: done,
			handler: authenticationHandler
		});
	});

	it( 'rejects userA with user B\'s password', function( done ){
		testAuthentication({
			username: 'userA',
			password: 'userBPass',
			expectedResult: false,
			done: done,
			handler: authenticationHandler
		});
	});

	it( 'accepts userB with user B\'s password', function( done ){
		testAuthentication({
			username: 'userB',
			password: 'userBPass',
			expectedResult: true,
			serverData: null,
			clientData: { "all": "client data" },
			done: done,
			handler: authenticationHandler
		});
	});

	it( 'rejects unknown userQ', function( done ){
		testAuthentication({
			username: 'userQ',
			password: 'userBPass',
			expectedResult: false,
			done: done,
			handler: authenticationHandler
		});
	});
});

describe( 'errors for invalid settings', function(){
	var getSettings = function() {
		return {
			path: './test/test-configs/users.json',
			hash: 'md5',
			iterations: 100,
			keyLength: 32
		};
	};

	it( 'accepts valid settings', function(){
		expect(function(){
			new AuthenticationHandler( getSettings() );
		}).not.toThrow();
	});

	it( 'errors for invalid path', function(){
		var settings = getSettings();
		settings.path = 42;
		expect(function(){
			new AuthenticationHandler( settings );
		}).toThrow();
	});

	it( 'accepts settings with hash = false', function(){
		var settings = {
			path: './test/test-configs/users-unhashed.json',
			hash: false
		};

		expect(function(){
			new AuthenticationHandler( settings );
		}).not.toThrow();
	});

	it( 'fails for settings with hash=string that miss hashing parameters', function(){
		var settings = {
			path: './test/test-configs/users-unhashed.json',
			hash: 'md5'
		};

		expect(function(){
			new AuthenticationHandler( settings );
		}).toThrow();
	});

	it( 'fails for settings with non-existing hash algorithm', function(){
		var settings = getSettings();
		settings.hash = 'does-not-exist';

		expect(function(){
			new AuthenticationHandler( settings );
		}).toThrow();
	});
});

describe( 'creates hashes', function(){
	var authenticationHandler;
	var settings = {
		path: './test/test-configs/users.json',
		hash: 'md5',
		iterations: 100,
		keyLength: 32
	};

	it( 'creates the authentication handler', function( done ){
		authenticationHandler = new AuthenticationHandler( settings );
		authenticationHandler.on( 'ready', done );
	});

	it( 'creates a hash', function( done ){
		authenticationHandler.createHash( 'userAPass', function( err, result ){
			expect( err ).toBe( null );
			expect( typeof result ).toBe( 'string' );
			done();
		});
	});
});

describe( 'errors for invalid configs', function(){
	it( 'loads a non existant config', function( done ){
		var authenticationHandler = new AuthenticationHandler({
			path: './does-not-exist.json',
			hash: false
		});
		authenticationHandler.on( 'error', function( error ){
			expect( error ).toContain( 'no such file or directory' );
			done();
		});
	});

	it( 'loads a broken config', function( done ){
		var authenticationHandler = new AuthenticationHandler({
			path: './test/test-configs/broken-json-config.json',
			hash: false
		});

		authenticationHandler.on( 'error', function( error ){
			expect( error.toString() ).toContain( 'Unexpected token }' );
			done();
		});
	});

	it( 'loads a user config without password field', function( done ){
		var authenticationHandler = new AuthenticationHandler({
			path: './test/test-configs/invalid-user-config.json',
			hash: false
		});

		authenticationHandler.on( 'error', function( error ){
			expect( error ).toBe( 'missing password for userB' );
			done();
		});
	});
});

describe( 'errors for invalid auth-data', function(){
	var authenticationHandler;
	var settings = {
		path: './test/test-configs/users.json',
		hash: 'md5',
		iterations: 100,
		keyLength: 32
	};

	it( 'creates the authentication handler', function( done ){
		authenticationHandler = new AuthenticationHandler( settings );
		authenticationHandler.on( 'ready', done );
	});

	it( 'returns an error for authData without username', function( done ){
			var authData = {
			password: 'some password'
		};

		var callback = function( result, data ) {
			expect( result ).toBe( false );
			expect( data.clientData ).toBe( 'missing authentication parameter username' );
			done();
		};

		authenticationHandler.isValidUser( null, authData, callback );
	});

	it( 'returns an error for authData without password', function( done ){
		var authData = {
			username: 'some user'
		};

		var callback = function( result, data ) {
			expect( result ).toBe( false );
			expect( data.clientData ).toBe( 'missing authentication parameter password' );
			done();
		};

		authenticationHandler.isValidUser( null, authData, callback );
	});

});
