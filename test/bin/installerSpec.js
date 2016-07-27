'use strict';
/* global jasmine, spyOn, describe, it, expect */

const path = require( 'path' );
const pj = path.join;
const proxyquire = require( 'proxyquire' );
const mkdirp = require( 'mkdirp' );
const Emitter = require( 'events' ).EventEmitter;
const Stream = require( 'stream' );

const noop = function() {};

// Needle mock
class Needle extends Emitter {
	constructor( response1, response2 ) {
		super();
		this.response1 = response1;
		this.response2 = response2;
	}
	get( urlPath, options, callback ) {
		if ( urlPath.indexOf( 'https://api' ) !== -1 ) {
			return this.response1( urlPath, options, callback );
		} else {
			return this.response2( urlPath, options, callback );
		}
	}
}

function createZipMock( cb1, cb2 ) {
	if ( cb1 == null ) { cb1 = noop; }
	if ( cb2 == null ) { cb2 = noop; }
	class ZipMock {
		constructor( filePath ) {
			cb1( filePath );
		}
		extractAllTo( directory, overwrite ) {
			cb2( directory, overwrite );
		}
	}
	return ZipMock;
}

const dummyReadStream = function( options ) {
	return function() {
		var stream = new Stream.Readable();
		if ( options && options.error ) {
			this.emit( 'error', options.error );
		} else {
			stream.push( 'chunk' );
			stream.push( null );
			return stream;
		}
	};
};
const dummyWritedStream = function( options ) {
	return function() {
		var stream = new Stream.Writable();
		stream._write = function( chunk, enc, next ) {
			if ( options && options.error ) {
				stream.emit( 'error', options.error );
			} else {
				next();
			}
		};
		return stream;
	};
};

describe( 'installer', function() {
	process.env.QUIET = 1; // do not print out to stdout
	const archiveUrl = 'https://github.com/deepstream.io-cache-redis-test.zip';
	const assets = [
		{ name: 'windows', browser_download_url: archiveUrl },
		{ name: 'linux', browser_download_url: archiveUrl },
		{ name: 'mac', browser_download_url: archiveUrl }
	];

	it( 'handle network error', function( done ) {
		const needleMock = new Needle(
			// request handler for fetching all releases
			function( urlPath, options, callback ) {
				return callback( new Error( 'network-dummy-error' ) );
			}
		);
		needleMock['@noCallThru'] = true;
		var installer = proxyquire( '../../bin/installer', {
			needle: needleMock
		} );

		installer( {type: 'foo', name: 'bar'}, function( error ) {
			expect( error.toString() ).toContain( 'network-dummy-error' );
			done();
		} );
	} );

	it( 'connector not found', function( done ) {
		const needleMock = new Needle(
			// request handler for fetching all releases
			function( urlPath, options, callback ) {
				return callback( null, { statusCode: 404 } );
			}
		);
		needleMock['@noCallThru'] = true;
		var installer = proxyquire( '../../bin/installer', {
			needle: needleMock
		} );

		installer( {type: 'foo', name: 'bar'}, function( error ) {
			expect( error.toString() ).toContain( 'Not found' );
			expect( error.toString() ).toContain( 'see available' );
			done();
		} );
	} );

	it( 'connector found but not the version', function( done ) {
		const needleMock = new Needle(
			// request handler for fetching all releases
			function( urlPath, options, callback ) {
				return callback( null, {
					statusCode: 200,
					body: [{ tag_name: '1.2.1', assets: assets }]
				} );
			}
		);
		needleMock['@noCallThru'] = true;
		var installer = proxyquire( '../../bin/installer', {
			needle: needleMock
		} );

		installer( {type: 'foo', name: 'bar', version: '1.2.3'}, function( error ) {
			expect( error.toString() ).toContain( '1.2.3 not found' );
			expect( error.toString() ).toContain( 'deepstream.io-foo-bar/releases' );
			done();
		} );
	} );

	it( 'connector found but not the platform', function( done ) {
		const needleMock = new Needle(
			// request handler for fetching all releases
			function( urlPath, options, callback ) {
				return callback( null, {
					statusCode: 200,
					body: [{ tag_name: '1.2.3', assets: [
						{ name: 'other-os', browser_download_url: archiveUrl }
					] }]
				} );
			}
		);
		needleMock['@noCallThru'] = true;
		var installer = proxyquire( '../../bin/installer', {
			needle: needleMock
		} );

		installer( {type: 'foo', name: 'bar', version: '1.2.3'}, function( error ) {
			expect( error.toString() ).toContain( 'platform' );
			expect( error.toString() ).toContain( 'deepstream.io-foo-bar/releases' );
			done();
		} );
	} );

	it( 'error while downloading the archive', function( done ) {
		const fsMock = {
			createWriteStream: dummyWritedStream()
		};
		const needleMock = new Needle(
			// request handler for fetching all releases
			function( urlPath, options, callback ) {
				return callback( null, {
					statusCode: 200,
					body: [{ tag_name: '1.2.3', assets: assets }]
				} );
			},
			// request handler for all other requests, not starting with 'https://api'
			function( urlPath, options, callback ) {
				return callback( new Error('dummy-stream-read-error'))
			}
		);
		spyOn( mkdirp, 'sync' );
		needleMock['@noCallThru'] = true;
		var installer = proxyquire( '../../bin/installer', {
			needle: needleMock,
			fs: fsMock
		} );

		installer( {type: 'foo', name: 'bar', version: '1.2.3'}, function( error ) {
			expect( error.toString() ).toContain( 'dummy-stream-read-error' );
			done();
		} );
	} );

	it( 'error while extracting the archive', function( done ) {
		const fsMock = {
			createWriteStream: dummyWritedStream()
		};
		const childProcessMock = {
			execSync: function() { throw new Error( 'Could not extract archive' );}
		};
		const needleMock = new Needle(
			// request handler for fetching all releases
			function( urlPath, options, callback ) {
				return callback( null, {
					statusCode: 200,
					body: [{ tag_name: '1.2.3', assets: assets }]
				} );
			},
			// request handler for all other requests, not starting with 'https://api'
			function( urlPath, options, callback ) {
				return callback( null, {body: ''})
			}
		);
		spyOn( mkdirp, 'sync' );
		needleMock['@noCallThru'] = true;
		var installer = proxyquire( '../../bin/installer', {
			needle: needleMock,
			fs: fsMock,
			child_process: childProcessMock
		} );

		installer( {type: 'foo', name: 'bar', version: '1.2.3', verbose: true}, function( error ) {
			expect( error.toString() ).toContain( 'extract' );
			done();
		} );
	} );

	it( 'downloads a connector and extract it', function( done ) {
		const fsMock = {
			readFileSync: function() {
				return 'config:\n	host: localhost\n	port: 1234';
			},
			createWriteStream: dummyWritedStream()
		};
		const needleMock = new Needle(
			// request handler for fetching all releases
			function( urlPath, options, callback ) {
				return callback( null, {
					statusCode: 200,
					body: [{ tag_name: '1.0.0', assets: assets }]
				} );
			},
			// request handler for all other requests, not starting with 'https://api'
			function( urlPath, options, callback ) {
				return callback( null, {body: ''})
			}
		);
		const zipConstructor = jasmine.createSpy( 'callback' );
		const zipExtractor = jasmine.createSpy( 'callback' );
		const zipMock = createZipMock( zipConstructor, zipExtractor );
		const child_processMock = {
			execSync: function() {}
		};

		spyOn( needleMock, 'get' ).and.callThrough();
		spyOn( mkdirp, 'sync' );
		spyOn( fsMock, 'readFileSync' ).and.callThrough();
		spyOn( fsMock, 'createWriteStream' ).and.callThrough();
		spyOn( child_processMock, 'execSync' );
		needleMock['@noCallThru'] = true;
		var installer = proxyquire( '../../bin/installer', {
			needle: needleMock,
			'adm-zip': zipMock,
			fs: fsMock,
			child_process: child_processMock
		} );

		var installOptions = {
			type: 'cache',
			name: 'redis',
			version: null,
			dir: null
		};

		installer( installOptions, function( error ) {
			expect( error ).toBeUndefined();
			// fetch all releases
			expect( needleMock.get.calls.argsFor( 0 )[0] )
				.toEqual( 'https://api.github.com/repos/deepstreamIO/deepstream.io-cache-redis/releases' );
			// fetch archive
			expect( needleMock.get.calls.argsFor( 1 )[0] )
				.toEqual( 'https://github.com/deepstream.io-cache-redis-test.zip' );
			// save archive
			expect( mkdirp.sync.calls.argsFor( 0 )[0] ).toEqual( 'lib' );
			expect( fsMock.createWriteStream.calls.argsFor( 0 )[0] )
				.toEqual( pj( 'lib', 'cache-redis-test-1.0.0.zip' ) );
			// prepare extract archive
			if ( child_processMock.execSync.calls.count() ) {
				expect( child_processMock.execSync.calls.argsFor( 0 )[0] )
					.toEqual( 'mkdir -p lib/deepstream.io-cache-redis && ' +
					'tar -xzf lib/cache-redis-test-1.0.0.zip -C lib/deepstream.io-cache-redis' );
			} else {
				expect( zipConstructor.calls.argsFor( 0 )[0] ).toEqual( pj( 'lib', 'cache-redis-test-1.0.0.zip' ) );
				expect( zipExtractor.calls.argsFor( 0 ) ).toEqual( [ pj( 'lib', 'deepstream.io-cache-redis' ), true ] );
			}
			// show example config
			expect( fsMock.readFileSync.calls.argsFor( 0 )[0] )
				.toEqual( pj( 'lib', 'deepstream.io-cache-redis', 'example-config.yml' ) );
			done();
		} );

	} );

} );
