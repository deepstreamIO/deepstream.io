var HttpMock = function(){};

HttpMock.prototype.createServer = function() {
	return {
		listen: function() {},
		close: function( callback ) {  callback && callback(); }
	}
};

module.exports = HttpMock;