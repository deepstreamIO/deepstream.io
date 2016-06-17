var PermissionHandler = require( '../../src/permission/open-permission-handler' );

describe( 'open permission handler', function(){
	var permissionHandler;

	it( 'creates the handler', function(){
		permissionHandler = new PermissionHandler();
		expect( typeof permissionHandler.canPerformAction ).toBe( 'function' );
		expect( permissionHandler.type ).toBe( 'none' );
	});

	it( 'allows any action', function( done ){
		var message = {
			topic: 'This doesnt matter',
			action: 'Since it allows anything',
			data: [ 'anything' ]
		};
		permissionHandler.canPerformAction( 'someone', message, function( error, success ) {
			expect( error ).toBeNull();
			expect( success ).toBe( true );
			done();
		}, {} );
	});

});