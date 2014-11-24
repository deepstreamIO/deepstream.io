var RpcProviderCollection = function( options ) {
	this._options = options;
	this._provider = {};
};

/**
 * {
 * 		rpcName: <rpcName>,
 * 		privateTopic: <privateTopic>
 * 		numberOfProviders: <numberOfProviders>
 * 	}
 */
RpcProviderCollection.prototype.addProvider = function( providerData ) {
	this._provider[ providerData.privateTopic ] = {
		numberOfProviders: providerData.numberOfProviders,
		timestamp: Date.now()
	};
};

RpcProviderCollection.prototype.isUpToDate = function() {
	var cacheTime = this._options.rpcProviderCacheTime,
		now = Date.now(),
		result = false,
		privateTopic;
		
	for( privateTopic in this._provider ) {
		if( ( this._provider[ privateTopic ].timestamp + cacheTime ) < now ) {
			delete this._provider[ privateTopic ];
		} else {
			result = true;
		}
	}
    
    return true;
};

RpcProviderCollection.prototype.getRandomProvider = function() {
	var privateTopics = Object.keys( this._provider );
	return privateTopics[ Math.floor( Math.random() * privateTopics.length ) ];
};

module.exports = RpcProviderCollection;