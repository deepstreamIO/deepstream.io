var C = require( '../constants/constants' ),
	RpcProviderCollection = require( './remote-rpc-provider-collection' ),
	ProviderProxy = require( './remote-rpc-provider-proxy' ),
	EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' );

var RemoteRpcProviderRegistry = function( options ) {
	this._options = options;
	this._options.messageConnector.subscribe( C.TOPIC.RPC, this._processRpcMessage.bind( this ) );
	this._providerCollections = {};
	this._queryTimeouts = {};
	this._providerAvailableEvent = 'providerAvailableFor';
};

utils.inherits( RemoteRpcProviderRegistry, EventEmitter );

RemoteRpcProviderRegistry.prototype.getProviderProxy = function( rpcName, callback ) {
	if( this._hasProviderForRpcName( rpcName ) ) {
		callback( null, this._getProxy( rpcName ) );
	} else {
		this.once( this._providerAvailableEvent + rpcName, callback );
		this._queryProviders( rpcName );
	}
};

RemoteRpcProviderRegistry.prototype._getProxy = function( rpcName ) {
	var privateTopic = this._providerCollections[ rpcName ].getRandomProvider();
	return new ProviderProxy( this._options, privateTopic );
};

RemoteRpcProviderRegistry.prototype._processRpcMessage = function( msg ) {
	if( msg.action === C.ACTIONS.PROVIDER_UPDATE ) {
		this._onProviderUpdate( msg.data );
	}
};

RemoteRpcProviderRegistry.prototype._onProviderUpdate = function( providerData ) {
	for( var i = 0; i < providerData.length; i++ ) {
		this._addProvider( providerData[ i ].rpcName, providerData[ i ] );
	}
};

RemoteRpcProviderRegistry.prototype._addProvider = function( rpcName, providerData ) {
	if( !this._providerCollections[ rpcName ] ) {
		this._providerCollections[ rpcName ] = new RpcProviderCollection( this._options );
	}
	
	this._providerCollections[ rpcName ].addProvider( providerData );
	
	if( this._queryTimeouts[ rpcName ] !== undefined ) {
		clearTimeout( this._queryTimeouts[ rpcName ] );
		delete this._queryTimeouts[ rpcName ];
	}

	this.emit( this._providerAvailableEvent + rpcName, null, this._getProxy( rpcName ) );
};

RemoteRpcProviderRegistry.prototype._hasProviderForRpcName = function( rpcName ) {
	return this._providerCollections[ rpcName ] && this._providerCollections[ rpcName ].isUpToDate();
};

RemoteRpcProviderRegistry.prototype._queryProviders = function( rpcName, callback ) {
	
	/*
	 * Query for rpcName is already in flight
	 */
	if( this._queryTimeouts[ rpcName ] !== undefined ) {
		return;
	}

	this._providerCollections[ rpcName ] = null;
	
	var queryMessage = {
		topic: C.TOPIC.RPC,
		action: C.ACTIONS.QUERY,
		data: [ rpcName ]
	};
	
	this._options.messageConnector.publish( C.TOPIC.RPC, queryMessage );
	
	this._queryTimeouts[ rpcName ] = setTimeout( 
		this._onProviderQueryTimeout.bind( this, rpcName ), 
		this._options.rpcProviderQueryTimeout 
	);
};

RemoteRpcProviderRegistry.prototype._onProviderQueryTimeout = function( rpcName ) {
	this.emit( this._providerAvailableEvent + rpcName, C.EVENT.NO_RPC_PROVIDER );
};

module.exports = RemoteRpcProviderRegistry;