var fs = require('fs');
var path = require('path');
var os = require( 'os' );
var glob = require('glob');
var meta = require( '../meta.json' );

module.exports = function( program ) {
	program
		.command( 'info' )
		.description( 'print meta information about build and runtime' )
		.option( '-l, --libPrefix [directory]', 'directory of plugins, defaults to ./lib' )
		.action( printMeta );
};

function printMeta() {
	meta.platform = os.platform();
	meta.arch = os.arch();
	meta.nodeVersion = process.version;
	fetchLibs(this.libPrefix, meta);
	console.log( JSON.stringify( meta, null, 2 ) );
}

function fetchLibs(libPrefix, meta) {
	var directory = libPrefix || 'lib';
	console.log('checking path: ', directory);
	var files = glob.sync(path.join(directory, '*', 'package.json'));
	meta.libs = files.map(function(filePath) {
		var pkg = fs.readFileSync(filePath, 'utf8');
		var object = JSON.parse(pkg);
		return object.name + ':' + object.version;
	});
}
