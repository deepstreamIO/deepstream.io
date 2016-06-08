var LoggerMock = function() {
		this.isReady = true;
		this.lastLogLevel = null;
		this.lastLogEvent = null;
		this.lastLogMessage = null;
};

LoggerMock.prototype.log = function( level, event, message ) {
		this.lastLogLevel = level;
		this.lastLogEvent = event;
		this.lastLogMessage = message;

		if( this.lastLogLevel > 2 )
			console.log( message )
};

LoggerMock.prototype.setLogLevel = function( level ) {
};

module.exports = LoggerMock;