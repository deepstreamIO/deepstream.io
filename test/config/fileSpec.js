var file = require( '../../src/config/file' );
var path = require( 'path' );

describe( 'file tests', function() {

	it( 'check cases with no or a relative prefix', function() {
		// node style path (no dot at the start and not absolute path)
		expect( file.lookupRequirePath( 'foo-bar' ) ).toEqual( 'foo-bar' );
		expect( file.lookupRequirePath( 'dir/foo-bar' ) ).toEqual( 'dir/foo-bar' );
		expect( file.lookupRequirePath( 'foo-bar', 'pre' ) ).toEqual( path.resolve( 'pre', 'foo-bar' ) );
		expect( file.lookupRequirePath( 'dir/foo-bar', 'pre' ) ).toEqual( path.resolve( 'pre', 'dir', 'foo-bar' ) );

		// use an absolute path for the filename
		expect( file.lookupRequirePath( '/usr/foo-bar' ) ).toEqual( '/usr/foo-bar' );
		expect( file.lookupRequirePath( '/usr/dir/foo-bar' ) ).toEqual( '/usr/dir/foo-bar' );
		expect( file.lookupRequirePath( '/usr/foo-bar', 'pre' ) ).toEqual( '/usr/foo-bar' );
		expect( file.lookupRequirePath( '/usr/dir/foo-bar', 'pre' ) ).toEqual( '/usr/dir/foo-bar' );

		// use a relative path for the filename
		expect( file.lookupRequirePath( './foo-bar' ) ).toEqual( path.resolve( 'foo-bar' ) );
		expect( file.lookupRequirePath( './dir/foo-bar' ) ).toEqual( path.resolve( 'dir', 'foo-bar' ) );
		expect( file.lookupRequirePath( './foo-bar', 'pre' ) ).toEqual( path.resolve( 'pre', 'foo-bar' ) );
		expect( file.lookupRequirePath( './dir/foo-bar', 'pre' ) ).toEqual( path.resolve( 'pre', 'dir', 'foo-bar' ) );
	} );

	it( 'check cases with an absolute prefix', function() {
		// node style path (no dot at the start and not absolute path)
		expect( file.lookupRequirePath( 'foo-bar', '/pre' ) ).toEqual( path.resolve( '/pre', 'foo-bar' ) );
		expect( file.lookupRequirePath( 'dir/foo-bar', '/pre' ) ).toEqual( path.resolve( '/pre', 'dir', 'foo-bar' ) );

		// use an absolute path for the filename
		expect( file.lookupRequirePath( '/usr/foo-bar', '/pre' ) ).toEqual( '/usr/foo-bar' );
		expect( file.lookupRequirePath( '/usr/dir/foo-bar', '/pre' ) ).toEqual( '/usr/dir/foo-bar' );

		// use a relative path for the filename
		expect( file.lookupRequirePath( './foo-bar', '/pre' ) ).toEqual( path.resolve( '/pre', 'foo-bar' ) );
		expect( file.lookupRequirePath( './dir/foo-bar', '/pre' ) ).toEqual( path.resolve( '/pre', 'dir', 'foo-bar' ) );
	} );
} );
