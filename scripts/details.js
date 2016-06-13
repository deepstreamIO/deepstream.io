var exec = require( 'child_process' ).execSync;

if( process.argv[2] === 'VERSION' ) {
	console.log( require('../package').version )
} else if( process.argv[2] === 'NAME' ) {
	console.log( require('../package').name )
} else if( process.argv[2] === 'OS' ) {
	console.log( require('os').platform() )
} else if( process.argv[2] === 'COMMIT' ) {
	console.log( exec( 'git log --pretty=format:%h -n 1' ).toString() )
}	else {
	console.log( 'ERROR: Pass in VERSION or NAME as env variable' )
}