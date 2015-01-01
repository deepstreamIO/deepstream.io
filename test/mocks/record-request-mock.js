var RecordRequestMock = function( recordName, options, socketWrapper, onComplete, onError ) {
	this.recordName = recordName;
	this.onComplete = onComplete;
	this.onError = onError;
};

module.exports = RecordRequestMock;