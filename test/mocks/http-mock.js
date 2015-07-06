var SocketMock = require( './socket-mock' );

var HttpMock = function(){};

HttpMock.prototype.createServer = function() {
	return {
		listen: function() {},
		close: function() {}
	}
};

module.exports = new HttpMock();