var StorageMock = function() {
	this.values = {};
	this.nextOperationWillBeSuccessful = true;
	this.nextOperationWillBeSynchronous = true;
	this.completedSetOperations = 0;
};

StorageMock.prototype.set = function( key, value, callback ) {
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