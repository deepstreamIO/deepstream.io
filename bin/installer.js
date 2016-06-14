'use strict';

const colors = require( 'colors' );
const needle = require( 'needle' );
const fs = require( 'fs' );
const path = require( 'path' );
const os = require( 'os' );
const AdmZip = require( 'adm-zip' );
const execSync = require( 'child_process' ).execSync;
const mkdirp = require( 'mkdirp' );

const CONFIG_EXAMPLE_FILE = 'README.md';
const SYSTEM = {
	'linux': 'linux',
	'darwin': 'mac',
	'win32': 'windows'
};
const platform = SYSTEM[ os.platform() ];

const getWebUrl = function( repo ) {
	return `https://github.com/deepstreamIO/${repo}/releases`;
};

const downloadRelease = function( releases, type, name, version, outputDir, callback ) {
	outputDir = outputDir == null ? 'lib' : outputDir;
	const repo = `deepstream.io-${type}-${name}`;
	const filteredReleases = releases.filter( item => {
		if ( version == null ) {
			return true;
		}
		return item.tag_name === version || item.tag_name === 'v' + version;
	} );
	if ( filteredReleases.length === 0 ) {
		return callback( new Error( `${repo} ${version} not found, see ${getWebUrl( repo )}` ) );
	}
	const release = filteredReleases[0];
	version = version == null ? release.tag_name : version;
	const releaseForMachine = release.assets.filter( item => item.name.indexOf( platform ) !== -1 );
	if ( releaseForMachine.length === 0 ) {
		return callback( new Error( `relase for your platform not found, see ${getWebUrl( repo )}` ) );
	}

	const downloadUrl = releaseForMachine[0].browser_download_url;
	const extension = path.extname( downloadUrl );
	const basename = path.basename( downloadUrl, extension ).replace( 'deepstream.io-', '' );
	const urlBase = 'https://github.com';
	const urlPath = downloadUrl.substr( urlBase.length );
	const basenameWithVersion = `${basename}-${version}${extension}`;
	const outputFile = path.join( outputDir, basenameWithVersion );
	mkdirp.sync( outputDir );

	if ( process.env.VERBOSE ) {
		console.log( 'downloading version ' + version );
	}
	const outStream = fs.createWriteStream( outputFile );
	downloadArchive( urlPath, outStream, function( err ) {
		if ( err ) {
			return callback ( err );
		}
		callback( null, {
			archive: outputFile,
			name: repo,
			version: version
		} );
	} );
};

const downloadArchive = function( urlPath, outStream, callback ) {
	try {
		needle.get( 'https://github.com' + urlPath, {
			follow_max: 5,
			headers: {'User-Agent': 'nodejs-client'}
		} )
		.on( 'readable', function() {
			if ( process.env.VERBOSE ) {
				process.stdout.write( '.'.grey );
			}
		} )
		.on( 'end', function() {
			if ( process.env.VERBOSE ) {
				process.stdout.clearLine();
				process.stdout.cursorTo( 0 );
				process.stdout.write( 'download complete' + '\n' );
			}
			return callback();
		} )
		.pipe( outStream )
		.on( 'error', function( err ) {
			// TODO: if the outStream throws an error callback will be
			// called twice, need to figure out, how to solve, maybe with 'pump'
			console.error( 'Error while saving the archive', err );
		} );
	} catch ( err ) {
		return callback( err );
	}
};

const fetchReleases = function( type, name, callback ) {
	const repo = `deepstream.io-${type}-${name}`;
	const urlPath = `/repos/deepstreamIO/${repo}/releases`;
	if ( process.env.VERBOSE ) {
		console.log( 'searching for ' + repo );
	}
	needle.get( 'https://api.github.com' + urlPath, {
		headers: {'User-Agent': 'nodejs-client'}
	}, function( error, response ) {
		if ( error ) {
			return callback( error );
		}
		if ( response.statusCode === 404 ) {
			return callback( new Error( 'not found, see available connectors on https://deepstream.io/download' ) );
		}
		callback( null, response.body );
	} );
};

const extract = function( data, platform ) {
	var archivePath = data.archive;
	const outputParent = path.dirname( archivePath );
	var outPath = path.join( outputParent, data.name );
	try {
		if ( platform === 'linux'  ) {
			execSync( `mkdir -p ${outPath} && tar -xzf ${archivePath} -C ${outPath}` );
		} else {
			extractZip( archivePath, outPath );
		}
	} catch ( err ) {
		if ( process.env.VERBOSE ) {
			console.error( err );
		}
		throw new Error( 'Could not extract archive' );
	}
	if ( !process.env.QUIET ) {
		console.log( colors.green( `${data.name} ${data.version} was installed to ${outputParent}` ) );
	}
	return outPath;
};

const extractZip = function( archivePath, outputDirectory ) {
	var zip = new AdmZip( archivePath );
	zip.extractAllTo( outputDirectory, true );
};

const showConfig = function( directory ) {
	var content = fs.readFileSync( path.join( directory, CONFIG_EXAMPLE_FILE ), 'utf8' );
	if ( process.env.VERBOSE ) {
		console.log( 'you need to configure the connector in your deepstream configuration file' );
	}
	content = '  ' + content.replace( /\n/g, '\n  ' );
	if ( !process.env.QUIET ) {
		console.log( 'example configuration:\n' + colors.grey( content ) );
	}
};

module.exports = function( opts, callback ) {
	fetchReleases( opts.type, opts.name, function( error, releases ) {
		if ( error ) {
			return callback( error );
		}
		downloadRelease( releases, opts.type, opts.name, opts.version, opts.dir, function( error, result ) {
			if ( error ) {
				return callback( error );
			}
			try {
				var extractedDirectory = extract( result, platform );
				showConfig( extractedDirectory );
				callback();
			} catch ( error ) {
				callback( error );
			}
		} );
	} );
};
