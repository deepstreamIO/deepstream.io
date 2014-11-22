var RpcProviderCollection = function( options ) {
	this._options = options;
	this._provider = {};
};

/**
 * {
 * 		rpcName: <rpcName>,
 * 		serverName: <serverName>
 * 		numberOfProviders: <numberOfProviders>
 * 	}
 */
RpcProviderCollection.prototype.addProvider = function( providerData ) {
	this._provider[ providerData.serverName ] = {
		numberOfProviders: providerData.numberOfProviders,
		timestamp: Date.now()
	};
};

RpcProviderCollection.prototype.isUpToDate = function() {
	var cacheTime = this._options.rpcProviderCacheTime,
		now = Date.now(),
		result = false,
		serverName;
		
	for( serverName in this._provider ) {
		if( ( this._provider[ serverName ].timestamp + cacheTime ) < now ) {
			delete this._provider[ serverName ];
		} else {
			result = true;
		}
	}
    
    return true;
};

RpcProviderCollection.prototype.getRandomProvider = function() {
	
};

module.exports = RpcProviderCollection;