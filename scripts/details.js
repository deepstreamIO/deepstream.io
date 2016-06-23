var exec = require( 'child_process' ).execSync;
var fs = require( 'fs' );
var path = require( 'path' );
var pkg = require( '../package' );

if( process.argv[2] === 'VERSION' ) {
	console.log( pkg.version );
} else if( process.argv[2] === 'NAME' ) {
	console.log( pkg.name );
} else if( process.argv[2] === 'OS' ) {
	console.log( require( 'os' ).platform() );
} else if( process.argv[2] === 'COMMIT' ) {
	console.log( exec( 'git log --pretty=format:%h -n 1' ).toString() );
} else if( process.argv[2] === 'META' ) {
	writeMetaFile();
}	else {
	console.log( 'ERROR: Pass in VERSION or NAME as env variable' );
}

function writeMetaFile() {
	var meta = {
		deepstreamVersion: pkg.version,
		gitRef: exec( 'git rev-parse HEAD' ).toString().trim(),
		buildTime: new Date().toString()
	};
	fs.writeFileSync( path.join( __dirname, '..', 'meta.json' ), JSON.stringify( meta, null, 2 ), 'utf8' );
}
