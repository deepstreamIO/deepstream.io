var fs = require('fs');
var path = require('path');
var os = require( 'os' );
var glob = require('glob');

module.exports = function( program ) {
	program
		.command( 'info' )
		.description( 'print meta information about build and runtime' )
		.option( '-l, --libPrefix [directory]', 'directory of plugins, defaults to ./lib' )
		.action( printMeta );
};

function printMeta() {
	var meta;
	try {
		meta = require( '../meta.json' );
	} catch (err) {
		// if deepstream is not installed as binary (source or npm)
		pkg = require('../package.json')
		meta = {
			deepstreamVersion: pkg.version,
			ref: pkg.gitHead || pkg._resolved || 'N/A',
			buildTime: 'N/A'
		}
	}
	meta.platform = os.platform();
	meta.arch = os.arch();
	meta.nodeVersion = process.version;
	fetchLibs(this.libPrefix, meta);
	console.log( JSON.stringify( meta, null, 2 ) );
}

function fetchLibs(libPrefix, meta) {
	var directory = libPrefix || 'lib';
	var files = glob.sync(path.join(directory, '*', 'package.json'));
	meta.libs = files.map(function(filePath) {
		var pkg = fs.readFileSync(filePath, 'utf8');
		var object = JSON.parse(pkg);
		return object.name + ':' + object.version;
	});
}
