var StdOutLogger = function() {
	this.isReady = true;
	
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
		console.log( msg[ this._logLevelColors[ logLevel ] ] );
	}
};

StdOutLogger.prototype.setLogLevel = function( logLevel ) {
	this._currentLogLevel = logLevel;
};

module.exports = new StdOutLogger();