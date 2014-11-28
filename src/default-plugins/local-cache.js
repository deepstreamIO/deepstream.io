var EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' );

var LocalCache = function() {
	this.isReady = true;
	this._data = {};

	process.nextTick( this.emit.bind( this, 'ready' ) );
};

utils.inherits( LocalCache, EventEmitter );

LocalCache.prototype.set = function( key, value, callback ) {
	this._data[ key ] = value;
	callback( null );
};

LocalCache.prototype.get = function( key, callback ) {
	callback( null, this._data[ key ] || null );
};

module.exports = LocalCache;