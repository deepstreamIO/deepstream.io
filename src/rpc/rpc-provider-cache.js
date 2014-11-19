var C = require( '../contants/constants' ),
    RpcProviderCollection = require( './rpc-provider-collection' );

var RpcProviderCache = function( options ) {
    this._options = options;
    this._options.messageConnector.subscribe( C.TOPIC.RPC_CTRL, this._processRpcControlMessage.bind( this ) );
    this._providerCollections = {};
};

RpcProviderCache.prototype.getProviderTopic = function( rpcName, callback ) {
    if( this._hasProviderForRpcName( rpcName ) ) {
        callback( null, this._getRandomProvider( rpcName ) );
    } else {
        this._queryProviders( rpcName, callback );
    }
};

RpcProviderCache.prototype._processRpcControlMessage = function( msg ) {
    if( msg.action === C.ACTIONS.PROVIDER_UPDATE ) {
        this._addProviders( msg.data );
    }
    
    else if( msg.action === C.ACTIONS.QUERY ) {
        this._handleQuery( msg );
    }
};

RpcProviderCache.prototype._handleQuery = function( msg ) {
    
};

RpcProviderCache.prototype._addProviders = function( providerData ) {
    var rpcName, i;
    
    for( i = 0; i < providerData.length; i++ ) {
        rpcName = providerData[ i ].rpcName;
        
        if( !this._providerCollections[ rpcName ] ) {
            this._providerCollections[ rpcName ] = new RpcProviderCollection( this._options );
        }
        
        this._providerCollections[ rpcName ].addProvider( providerData[ i ] );
    }
};

RpcProviderCache.prototype._hasProviderForRpcName = function( rpcName ) {
    return this._providerCollections[ rpcName ] && this._providerCollections[ rpcName ].isUpToDate();
};

RpcProviderCache.prototype._queryProviders = function( rpcName, callback ) {
    this._providerCollections[ rpcName ] = null;
    
    var queryMessage = {
  		topic: C.TOPIC.RPC_CTRL,
  		action: C.ACTIONS.QUERY,
  		data: [{
		    rpcName: rpcName
    	}]
    };
    
    this._options.messageConnector.publish( C.TOPIC.RPC_CTRL, queryMessage );
};


module.exports = RpcProviderCache;