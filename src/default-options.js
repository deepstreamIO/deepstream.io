module.exports = {
	port: 6020,
	permissionHandler: require( './default-plugins/open-permission-handler' ),
	logger: require( './default-plugins/std-out-logger' ),

	/*
	 * Security
	 */
	maxAuthAttempts: 3,
	logInvalidAuthData: true
};