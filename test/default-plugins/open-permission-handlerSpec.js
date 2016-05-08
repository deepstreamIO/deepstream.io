var permissionHandler = require( '../../src/default-plugins/open-permission-handler' );

describe( 'permits all actions and logins', function(){

	it( 'returns true for isValidUser without username', function(){
		var cb = jasmine.createSpy( 'callback' );
		permissionHandler.isValidUser( null, {}, cb );
		expect(cb ).toHaveBeenCalledWith( null, 'open' );
	});

	it( 'returns true for isValidUser with username', function(){
		var cb = jasmine.createSpy( 'callback' );
		permissionHandler.isValidUser( null, { username: 'Bobo' }, cb );
		expect(cb ).toHaveBeenCalledWith( null, 'Bobo' );
	});

	it( 'returns true for canPerformAction', function(){
		var cb = jasmine.createSpy( 'callback' );
		permissionHandler.canPerformAction( null, null, cb );
		expect(cb ).toHaveBeenCalledWith( null, true );
	});
});