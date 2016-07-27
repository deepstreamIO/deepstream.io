'use strict';

const colors = require( 'colors' );
const needle = require( 'needle' );
const fs = require( 'fs' );
const path = require( 'path' );
const os = require( 'os' );
const AdmZip = require( 'adm-zip' );
const execSync = require( 'child_process' ).execSync;
const mkdirp = require( 'mkdirp' );

const CONFIG_EXAMPLE_FILE = 'example-config.yml';
const SYSTEM = {
	'linux': 'linux',
	'darwin': 'mac',
	'win32': 'windows'
};
const platform = SYSTEM[ os.platform() ];

const getWebUrl = function( repo ) {
	return `https://github.com/deepstreamIO/${repo}/releases`;
};

/**
 * Download a release from GitHub releases API with with the deepstream connector
 * name convention: deepstreamIO/deepstream.io-TYPE-NAME
 *
 * @param  {array}    releases JSON array of the GitHub REST API for list releases
 * @param  {string}   type Connector type: {cache|message|storage}
 * @param  {string}   name Name of the connector
 * @param  {string}   version Version of the connector (optional)
 * @param  {string}   outputDir Path to directory where to install and extract the connector
 * @callback callback
 * @param {error} error
 * @param {Object} {{archive: String, name: String, version: String}}
 * @return {void}
 */
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
		return callback( new Error( `Release for your platform not found, see ${getWebUrl( repo )}` ) );
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
		console.log( 'Downloading version ' + version );
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

/**
 * Downloads an archive usually zip or tar.gz from a URL which comes from the GitHub
 * release API.
 *
 * @param  {String}   urlPath URL where to download the archive
 * @param  {Stream}   writeable output stream to save the archive
 * @param  {Function} callback Callback (err)
 * @return {void}
 */
const downloadArchive = function( urlPath, outStream, callback ) {
	needle.get( 'https://github.com' + urlPath, {
		follow_max: 5,
		headers: {'User-Agent': 'nodejs-client'}
	}, (error, response) => {
		if ( error ) {
			return callback( error );
		}
		outStream.write(response.body)
		outStream.end()
		if ( process.env.VERBOSE ) {
			process.stdout.clearLine();
			process.stdout.cursorTo( 0 );
			process.stdout.write( 'Download complete' + '\n' );
		}
		return callback()
	} )
};

/**
 * Fetch a JSON array from GitHub Release API which contains all meta data
 * for a specific reposotiry.
 *
 * @param  {String}   type Connector type: {cache|message|storage}
 * @param  {String}   name Name of the connector
 * @callback callback
 * @param {error} error
 * @param {Object} JSON
 * @return {void}
 */
const fetchReleases = function( type, name, callback ) {
	const repo = `deepstream.io-${type}-${name}`;
	const urlPath = `/repos/deepstreamIO/${repo}/releases`;
	if ( process.env.VERBOSE ) {
		console.log( 'searching for ' + repo );
	}
	needle.get( 'https://api.github.com' + urlPath, {
		headers: {'User-Agent': 'nodejs-client'},
	}, function( error, response ) {
		if ( error ) {
			return callback( error );
		}
		if ( response.statusCode === 404 ) {
			return callback( new Error( 'Not found, see available connectors on https://deepstream.io/download' ) );
		}
		if ( response.statusCode == 403 ) {
			// API rate limit
			return callback( new Error(response.body.message))
		}
		callback( null, response.body );
	} );
};

/**
 * Fetch a JSON array from GitHub Release API which contains all meta data
 * for a specific reposotiry.
 *
 * @param  {Object}   data Contains archive: contains the archive path, name: contains the name of the  connector
 * @param  {String}   platform The current platform (windows, linux or mac)
 * @return {String}   outPath The directory where the connector was extracted to
 */
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

/**
 * Extracts an archive to a specific directory
 *
 * @param  {String}   archivePath
 * @param {String}   outputDirectory
 * @return {void}
 */
const extractZip = function( archivePath, outputDirectory ) {
	var zip = new AdmZip( archivePath );
	zip.extractAllTo( outputDirectory, true );
};

/**
 * Prints out the config snippet of a extract connector to the stdout.
 * Output is indented and grey colored.
 *
 * @param  {String}   directory where to lookup for CONFIG_EXAMPLE_FILE
 * @return {void}
 */
const showConfig = function( directory ) {
	try {
		var content = fs.readFileSync( path.join( directory, CONFIG_EXAMPLE_FILE ), 'utf8' );
		if ( process.env.VERBOSE ) {
			console.log( 'You need to configure the connector in your deepstream configuration file' );
		}
		if ( !process.env.QUIET ) {
			console.log( 'Example configuration:\n' + colors.grey( content ) );
		}
	} catch ( err ) {
		if ( !process.env.QUIET ) {
			console.log( 'Example configuration not found' );
		}
	}
};

/**
 * Download, extract and show configuration for deepstream connector
 *
 * @param  {Object}   opts {{type: String, name: string, version: String, dir: String}}
 * @param  {Function} callback Callback (err)
 * @return {void}
 */
module.exports = function( opts, callback ) {
	if (opts.type === 'message') {
		opts.type = 'msg'
	}
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
