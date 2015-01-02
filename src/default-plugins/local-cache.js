var LocalCache = function() {
	this.isReady = true;
	this._data = {};
};

LocalCache.prototype.set = function( key, value, callback ) {
	this._data[ key ] = value;
	callback( null );
};

LocalCache.prototype.get = function( key, callback ) {
	callback( null, this._data[ key ] || null );
};

LocalCache.prototype.delete = function( key, callback ) {
	delete this._data[ key ];
	callback( null );
};

module.exports = new LocalCache();