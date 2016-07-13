var fs = require('fs');
var path = require('path');
var os = require( 'os' );
var glob = require('glob');
const jsYamlLoader = require( '../src/config/js-yaml-loader' );

module.exports = function( program ) {
	program
		.command( 'info' )
		.description( 'print meta information about build and runtime' )
		.option( '-c, --config [file]', 'configuration file containing lib directory' )
		.option( '-l, --lib-dir [directory]', 'directory of libraries' )
		.action( printMeta );
};

function printMeta() {

	if( !this.libDir ) {
		try {
			global.deepstreamCLI = this;
			jsYamlLoader.loadConfigWithoutInitialisation();
			this.libDir = global.deepstreamLibDir;
		} catch( e ) {
			console.log( e )
			console.error( 'Please provide a libDir or a configFile to provide the relevant install information' );
			process.exit( 1 );
		}
	}

	var meta;
	try {
		meta = require( '../meta.json' );
	} catch (err) {
		// if deepstream is not installed as binary (source or npm)
		pkg = require( '../package.json' )
		meta = {
			deepstreamVersion: pkg.version,
			ref: pkg.gitHead || pkg._resolved || 'N/A',
			buildTime: 'N/A'
		}
	}
	meta.platform = os.platform();
	meta.arch = os.arch();
	meta.nodeVersion = process.version;
	fetchLibs( this.libDir, meta );
	console.log( JSON.stringify( meta, null, 2 ) );
}

function fetchLibs(libDir, meta) {
	var directory = libDir || 'lib';
	var files = glob.sync(path.join(directory, '*', 'package.json'));
	meta.libs = files.map(function(filePath) {
		var pkg = fs.readFileSync(filePath, 'utf8');
		var object = JSON.parse(pkg);
		return object.name + ':' + object.version;
	});
}
