var HttpMock = function(){};

HttpMock.prototype.createServer = function() {
	return {
		listen: function() {},
		close: function() {}
	}
};

module.exports = HttpMock;