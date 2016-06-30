const FileAuthenticationHandler = require( '../src/authentication/file-based-authentication-handler' );
const jsYamlLoader = require( '../src/config/js-yaml-loader' );

module.exports = function( program ) {
	program
		.command( 'encrypt [password]' )
		.description( 'Encrypt a plain text password using hash configuration set within configuration file' )
		.option( '-c, --config [file]', 'configuration file containing file auth and hash settings' )
		.action( encrypt );
}

function encrypt( password ) {
	const config = jsYamlLoader.loadConfigWithoutInitialisation().config;

	if( config.auth.type !== 'file' ) {
			console.error( 'Error: Can only use encrypt with file authentication as auth type' );
			process.exit( 1 );
	}

	if( !config.auth.options.hash ) {
			console.error( 'Error: Can only use encrypt with file authentication using hash' );
			process.exit( 1 );
	}

	config.auth.options.path  = '';

	if( !password ) {
			console.error( 'Error: Must provide password to encrypt' );
			process.exit( 1 );
	}

	// Mock file loading since a users.yml file is not required
	jsYamlLoader.readAndParseFile = function() {}

	const fileAuthenticationHandler = new FileAuthenticationHandler( config.auth.options );
	fileAuthenticationHandler.createHash( password, function( err, hash ) {
			if( err ) {
				console.error( 'Hash could not be created', err );
				process.exit( 1 );
			}
			console.log( 'Password hash:', hash );
	} );
}
