'use strict';

const https = require( 'https' );
const fs = require( 'fs' );
const path = require( 'path' );
const os = require( 'os' );
const url = require( 'url' );

const SYSTEM = {
	'linux': 'linux',
	'darwin': 'mac',
	'win32': 'windows'
};
const platform = SYSTEM[ os.platform() ];

const downloadRelease = function( releases, type, name, version, outputDir, callback ) {
	const repo = `deepstream.io-${type}-${name}`;
	releases.filter( item => {
		if ( version == null ) {
			return true;
		}
		return item.tag_name === version || item.tag_name === 'v' + version;
	} );
	if ( releases.length === 0 ) {
		callback( new Error( `connector ${repo} ${version} not found` ) );
	}
	version = releases[0].tag_name;
	const releaseForMachine = releases[0].assets.filter( item => item.name.indexOf( platform ) !== -1 );
	if ( releaseForMachine.length === 0 ) {
		callback( new Error( `relase for your platform not found` ) );
	}
	if ( outputDir == null ) {
		outputDir = 'lib';
	}
	const downloadUrl = releaseForMachine[0].browser_download_url;
	const extension = path.extname( downloadUrl );
	const urlBase = 'https://github.com';
	const urlPath = downloadUrl.substr( urlBase.length );

	const outputFile = `${outputDir}/${repo}${extension}`;

	try {
		// ignore if already exists
		fs.mkdirSync( outputDir );
	} catch ( err ) {}
	console.log( 'downloading version ' + version );
	https.get( {
		host: 'github.com',
		path: urlPath,
		port: 443,
		headers: { 'User-Agent': 'nodejs-client' }
	}, function( response ) {
		let body = '';
		response.on( 'data', function( chunk ) {
			process.stdout.write( '.' );
			body += chunk;
		} );
		response.on( 'end', function() {
			// check for redirect
			const matchedResult = body.match( /href="(.*)"/ );
			if ( matchedResult && matchedResult[1] != null ) {
				const encodedUrl = matchedResult[1].replace( /&amp;/g, '&' );
				// console.log( 'download from ' + encodedUrl );
				const urlObject = url.parse( encodedUrl );
				https.get( {
					host: urlObject.host,
					path: urlObject.path,
					port: 443,
					headers: { 'User-Agent': 'nodejs-client' }
				} ).on( 'response', function( response ) {
					const outStream = fs.createWriteStream( outputFile );
					response.on( 'data', function() {
						process.stdout.write( '.' );
					} );
						response.on( 'end', function() {
							console.log( '\ndownload complete' );
							callback();
						} );
					response.pipe( outStream );
				} );
			} else {
				console.log( '\ndownload complete' );
				fs.writeFile( outputFile, body, callback );
			}
		} );
	} );
};

const fetchReleases = function( type, name, callback ) {
	const repo = `deepstream.io-${type}-${name}`;
	const urlPath = `/repos/deepstreamIO/${repo}/releases`;
	console.log( 'searching for ' + repo );
	https.get( {
		host: 'api.github.com',
		path: urlPath,
		port: 443,
		headers: { 'User-Agent': 'nodejs-client' }
	}, function( response ) {
		let body = '';
		response.on( 'data', function( chunk ) {
			body += chunk;
		} );

		response.on( 'end', function() {
			console.log( 'meta data loaded' );
			const data = JSON.parse( body );
			callback( null, data );
		} );
	} );
};

module.exports = function( type, name, version, outputFile, callback ) {
	fetchReleases( type, name, function( error, releases ) {
		if ( error ) {
			return callback( error );
		}
		downloadRelease( releases, type, name, version, outputFile, callback );
	} );
};
