require( 'colors' );

var C = require( '../constants/constants' ),
	EOL = require( 'os' ).EOL;

/**
 * Logs to the operatingsystem's standard-out and standard-error streams.
 *
 * Consoles / Terminals as well as most log-managers and logging systems
 * consume messages from these streams
 *
 * @constructor
 */
var StdOutLogger = function( options ) {
	this._options = options || {};
	this.isReady = true;
	this._$useColors = this._options.colors === undefined ? true : this._options.colors;
	this._logLevelColors = [
		'white',
		'green',
		'yellow',
		'red'
	];

	this._currentLogLevel = C.LOG_LEVEL[ this._options.logLevel ] || C.LOG_LEVEL.DEBUG;
};

/**
 * Logs a line
 *
 * @param   {Number} logLevel   One of the C.LOG_LEVEL constants
 * @param   {String} event      One of the C.EVENT constants
 * @param   {String} logMessage Any string
 *
 * @public
 * @returns {void}
 */
StdOutLogger.prototype.log = function( logLevel, event, logMessage ) {
	if( logLevel < this._currentLogLevel ) {
		return;
	}

	var msg = event + ' | ' + logMessage,
		outputStream;

	if( logLevel === C.LOG_LEVEL.ERROR || logLevel === C.LOG_LEVEL.WARN ) {
		outputStream = 'stderr';
	} else {
		outputStream = 'stdout';
	}

	if( this._$useColors ) {
		process[ outputStream ].write( msg[ this._logLevelColors[ logLevel ] ] + EOL );
	} else {
		process[ outputStream ].write( msg + EOL );
	}
};

/**
 * Sets the log-level. This can be called at runtime.
 *
 * @param   {Number} logLevel   One of the C.LOG_LEVEL constants
 *
 * @public
 * @returns {void}
 */
StdOutLogger.prototype.setLogLevel = function( logLevel ) {
	this._currentLogLevel = logLevel;
};

module.exports = StdOutLogger;
