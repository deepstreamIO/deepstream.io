const pidHelper = require( './pid-helper' );

function statusCheck( cmd, program ) {
	pidHelper.read( function( err, data ) {
		if ( err ) {
			return console.log( 'not running (no pid file)' );
		}
		if ( pidHelper.isRunning( data.pid ) ) {
			const seconds = ( new Date().getTime() - data.timestamp ) / 1000;
			console.log( 'Process running with PID ' + data.pid + ' since ' + seconds + ' seconds' );
		} else {
			console.log( 'Not running (no process for PID ' + data.pid + ')');
		}
	} );
}

module.exports = function( program ) {
	program
		.command( 'status' )
		.description( 'display if a deepstream server is running' )
		.action( statusCheck );
}
