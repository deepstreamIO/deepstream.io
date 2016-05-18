var StorageMock = function() {
	this.reset();
};

StorageMock.prototype.reset = function() {
	this.values = {};
	this.failNextSet = false;
	this.nextOperationWillBeSuccessful = true;
	this.nextOperationWillBeSynchronous = true;
	this.nextGetWillBeSynchronous = true;
	this.lastGetCallback = null;
	this.lastRequestedKey = null;
	this.lastSetKey = null;
	this.lastSetValue = null;
	this.completedSetOperations = 0;
	this.getCalls = [];
	clearTimeout( this.getTimeout );
	clearTimeout( this.setTimeout );
};

StorageMock.prototype.delete = function( key, callback ) {
	delete this.values[ key ];
	callback( null );
};

StorageMock.prototype.hadGetFor = function( key ) {
	for( var i = 0; i < this.getCalls.length; i++ ) {
		if( this.getCalls[ i ][ 0 ] === key ) {
			return true;
		}
	}

	return false;
};

StorageMock.prototype.triggerLastGetCallback = function( errorMessage, value ) {
	this.lastGetCallback( errorMessage, value );
};

StorageMock.prototype.get = function( key, callback ) {
	this.getCalls.push( arguments );
	this.lastGetCallback = callback;
	this.lastRequestedKey = key;
	var value = this.values[ key ];

	if( this.nextGetWillBeSynchronous === true ) {
		callback( this.nextOperationWillBeSuccessful ? null : 'storageError', value );
	} else {
		this.getTimeout = setTimeout(function(){
			callback( this.nextOperationWillBeSuccessful ? null : 'storageError', value );
		}.bind( this ), 5 );
	}
};

StorageMock.prototype.set = function( key, value, callback ) {
	this.lastSetKey = key;
	this.lastSetValue = value;
	if( value._d === undefined ) {
		value = { _v:0, _d: value };
	}
	if( this.nextOperationWillBeSuccessful ) {
		this.values[ key ] = value;
	}

	if( this.nextOperationWillBeSynchronous ) {
		this.completedSetOperations++;
		if( this.failNextSet ) {
			this.failNextSet = false;
			callback( 'storageError' );
		}
		callback( this.nextOperationWillBeSuccessful ? null : 'storageError' );
	} else {
		this.setTimeout = setTimeout(function(){
			this.completedSetOperations++;
			callback( this.nextOperationWillBeSuccessful ? null : 'storageError' );
		}.bind( this ), 30 );
	}
};

module.exports = StorageMock;