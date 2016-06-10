'use strict';
/* global jasmine, spyOn, describe, it, expect */

var proxyquire = require( 'proxyquire' );
var mkdirp = require( 'mkdirp' );
var Emitter = require( 'events' ).EventEmitter;
var Stream = require( 'stream' );

class Needle extends Emitter {
	get( urlPath, options, callback ) {
		if ( urlPath.indexOf( 'https://api' ) !== -1 ) {
			return callback( null, {
				statusCode: 200,
				body: [
					{
						tag_name: '1.0.0',
						assets: [
							{
								name: 'windows',
								browser_download_url: 'https://github.com/deepstream.io-cache-redis-window.zip'
							},
							{
								name: 'linux',
								browser_download_url: 'https://github.com/deepstream.io-cache-redis-linux.tar.gz'}
								,
							{
								name: 'mac',
								browser_download_url: 'https://github.com/deepstream.io-cache-redis-mac.zip'
							}
						]
					}
				]
			} );
		} else {
			// simulates the archive file
			var stream = new Stream.Readable();
			stream.push( 'chunk' );
			stream.push( null );
			return stream;
		}
	}
}
const needleMock = new Needle();

const noop = function() {};

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

const fsMock = {
	readFileSync: function() {
		return 'config:\n  host: localhost\n  port: 1234';
	},
	createWriteStream: function() {
		var stream = new Stream.Writable();
		stream._write = function( chunk, enc, next ) {
			next();
		};
		return stream;
	}
};

describe( 'CLI installer', function() {

	it( 'downloads a connector and extract it', function( done ) {

		var zipConstructor = jasmine.createSpy( 'callback' );
		var zipExtractor = jasmine.createSpy( 'callback' );
		const zipMock = createZipMock( zipConstructor, zipExtractor );
		spyOn( needleMock, 'get' ).and.callThrough();
		spyOn( mkdirp, 'sync' );
		spyOn( fsMock, 'readFileSync' ).and.callThrough();
		spyOn( fsMock, 'createWriteStream' ).and.callThrough();
		var installer = proxyquire( '../../bin/installer', {
			needle: {
				get: needleMock.get,
			},
			'adm-zip': zipMock,
			fs: fsMock,
		} );


		var installOptions = {
			type: 'cache',
			name: 'redis',
			version: null,
			dir: null
		};
		process.env.QUITE = 1;
		installer( installOptions, function( error ) {
			expect( error ).toBeUndefined();
			// fetch all releases
			expect( needleMock.get.calls.argsFor( 0 )[0] )
				.toEqual( 'https://api.github.com/repos/deepstreamIO/deepstream.io-cache-redis/releases' );
			// fetch archive
			expect( needleMock.get.calls.argsFor( 1 )[0] )
				.toEqual( 'https://github.com/deepstream.io-cache-redis-mac.zip' );
			// save archive
			expect( mkdirp.sync.calls.argsFor( 0 )[0] ).toEqual( 'lib' );
			expect( fsMock.createWriteStream.calls.argsFor( 0 )[0] ).toEqual( 'lib/cache-redis-mac-1.0.0.zip' );
			// prepare extract archive
			expect( zipConstructor.calls.argsFor( 0 )[0] ).toEqual( 'lib/cache-redis-mac-1.0.0.zip' );

			expect( zipExtractor.calls.argsFor( 0 ) ).toEqual( [ 'lib/deepstream.io-cache-redis', true ] );
			// show example config
			expect( fsMock.readFileSync.calls.argsFor( 0 )[0] ).toEqual( 'lib/deepstream.io-cache-redis/README.md' );
			done();
		} );

	} );

} );
