var Deepstream = require( '../src/deepstream.io' );

describe( 'the main server class', function(){
	it( 'exposes the message parser\'s convertTyped method', function(){
		var server = new Deepstream();
		expect( server.convertTyped( 'N42' ) ).toBe( 42 );
	});

	it( 'exposes constants as a static', function(){
		expect( Deepstream.constants ).toBeDefined( );
	});
});
