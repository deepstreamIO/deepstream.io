var StdOutLogger = function() {

	this.isReady = true;
	this._$useColors = true;
	this._logLevelColors = [
		'white',
		'green',
		'yellow',
		'magenta'
	];

	this._currentLogLevel = 0;
};

StdOutLogger.prototype.log = function( logLevel, event, logMessage ) {
	if( logLevel >= this._currentLogLevel ) {
		var msg = event + ' | ' + logMessage;
		
		if( this._$useColors ) {
			process.stdout.write( msg[ this._logLevelColors[ logLevel ] ] + '\n' );
		} else {
			process.stdout.write( msg + '\n' );
		}
	}
};

StdOutLogger.prototype.setLogLevel = function( logLevel ) {
	this._currentLogLevel = logLevel;
};

module.exports = new StdOutLogger();