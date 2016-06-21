var fileUtils = require( '../../src/config/file-utils' );
var path = require( 'path' );

describe( 'fileUtils tests', function() {

	it( 'check cases with no or a relative prefix', function() {
		// node style path (no dot at the start and not absolute path)
		expect( fileUtils.lookupRequirePath( 'foo-bar' ) ).toEqual( 'foo-bar' );
		expect( fileUtils.lookupRequirePath( 'dir/foo-bar' ) ).toEqual( 'dir/foo-bar' );
		expect( fileUtils.lookupRequirePath( 'foo-bar', 'pre' ) ).toEqual( path.resolve( 'pre', 'foo-bar' ) );
		expect( fileUtils.lookupRequirePath( 'dir/foo-bar', 'pre' ) ).toEqual( path.resolve( 'pre', 'dir', 'foo-bar' ) );

		// use an absolute path for the fileUtilsname
		expect( fileUtils.lookupRequirePath( '/usr/foo-bar' ) ).toEqual( '/usr/foo-bar' );
		expect( fileUtils.lookupRequirePath( '/usr/dir/foo-bar' ) ).toEqual( '/usr/dir/foo-bar' );
		expect( fileUtils.lookupRequirePath( '/usr/foo-bar', 'pre' ) ).toEqual( '/usr/foo-bar' );
		expect( fileUtils.lookupRequirePath( '/usr/dir/foo-bar', 'pre' ) ).toEqual( '/usr/dir/foo-bar' );

		// use a relative path for the fileUtilsname
		expect( fileUtils.lookupRequirePath( './foo-bar' ) ).toEqual( path.resolve( 'foo-bar' ) );
		expect( fileUtils.lookupRequirePath( './dir/foo-bar' ) ).toEqual( path.resolve( 'dir', 'foo-bar' ) );
		expect( fileUtils.lookupRequirePath( './foo-bar', 'pre' ) ).toEqual( path.resolve( 'pre', 'foo-bar' ) );
		expect( fileUtils.lookupRequirePath( './dir/foo-bar', 'pre' ) ).toEqual( path.resolve( 'pre', 'dir', 'foo-bar' ) );
	} );

	it( 'check cases with an absolute prefix', function() {
		// node style path (no dot at the start and not absolute path)
		expect( fileUtils.lookupRequirePath( 'foo-bar', '/pre' ) ).toEqual( path.resolve( '/pre', 'foo-bar' ) );
		expect( fileUtils.lookupRequirePath( 'dir/foo-bar', '/pre' ) ).toEqual( path.resolve( '/pre', 'dir', 'foo-bar' ) );

		// use an absolute path for the fileUtilsname
		expect( fileUtils.lookupRequirePath( '/usr/foo-bar', '/pre' ) ).toEqual( '/usr/foo-bar' );
		expect( fileUtils.lookupRequirePath( '/usr/dir/foo-bar', '/pre' ) ).toEqual( '/usr/dir/foo-bar' );

		// use a relative path for the fileUtilsname
		expect( fileUtils.lookupRequirePath( './foo-bar', '/pre' ) ).toEqual( path.resolve( '/pre', 'foo-bar' ) );
		expect( fileUtils.lookupRequirePath( './dir/foo-bar', '/pre' ) ).toEqual( path.resolve( '/pre', 'dir', 'foo-bar' ) );
	} );
} );
