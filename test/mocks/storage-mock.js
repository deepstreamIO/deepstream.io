var StorageMock = function() {
	this.values = {};
	this.nextOperationWillBeSuccessful = true;
	this.nextOperationWillBeSynchronous = true;
	this.nextGetWillBeSynchronous = true;
	this.lastRequestedKey = null;
	this.lastSetKey = null;
	this.lastSetValue = null;
	this.completedSetOperations = 0;
};

StorageMock.prototype.delete = function( key, callback ) {
	delete this.values[ key ];
	callback( null );
};

StorageMock.prototype.get = function( key, callback ) {
	this.lastRequestedKey = key;
	var value = this.values[ key ];

	if( this.nextGetWillBeSynchronous === true ) {
		callback( null, value );
	} else {
		process.nextTick(function() {
			callback( null, value );
		});
	}
};

StorageMock.prototype.set = function( key, value, callback ) {
	this.lastSetKey = key;
	this.lastSetValue = value;
	
	if( this.nextOperationWillBeSuccessful ) {
		this.values[ key ] = value;
	}

	if( this.nextOperationWillBeSynchronous ) {
		this.completedSetOperations++;
		callback( this.nextOperationWillBeSuccessful ? null : 'storageError' );
	} else {
		setTimeout(function(){
			this.completedSetOperations++;
			callback( this.nextOperationWillBeSuccessful ? null : 'storageError' );
		}.bind( this ), 30 );
	}
};

module.exports = StorageMock;