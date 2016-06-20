const pidHelper = require( './pid-helper' );

module.exports = function( program ) {
	program
		.command( 'stop' )
		.description( 'stop a running deepstream server' )
		.action( pidHelper.stop );
}
