var C = require( '../constants/constants' ),
	RpcProviderCollection = require( './remote-rpc-provider-collection' ),
	EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' );

/**
 * This class keeps track of rpc providers that are connected to
 * OTHER deepstream instances.
 *
 * @param {Object} options deepstream options
 *
 * @extends EventEmitter
 * @constructor
 */
var RemoteRpcProviderRegistry = function( options ) {
	this._options = options;
	this._options.messageConnector.subscribe( C.TOPIC.RPC, this._processRpcMessage.bind( this ) );
	this._providerCollections = {};
	this._queryTimeouts = {};
	this._providerAvailableEvent = 'providerAvailableFor';
};

utils.inherits( RemoteRpcProviderRegistry, EventEmitter );

/**
 * The class' only public method. Recieves an rpcName and a callback
 * that will either be invoked immediatly when the requested remote
 * rpc provider is already available or after a delay once a query for
 * providers for <rpcName> has returned the first sucessful result.
 *
 * The callback will be invoked with two arguments: error and an instance
 * of remote-rpc-provider-proxy if error === null
 *
 * Please note: Rather than passing the callback around, it will be registered as
 * a one time listener for the _providerAvailableEvent<rpcName> event. This event will
 * be invoked either when a remote provider becomes available (e.g. when a PROVIDER_UPDATE message
 * is received from the messageConnector) or when the query times out without having received
 * any PROVIDER_UPDATE messages - in this case with a NO_RPC_PROVIDER error.
 *
 * @param   {String}   rpcName
 * @param   {Function} callback will be invoked with <error> and <rpc-provider-proxy>
 *
 * @public
 * @returns {void}
 */
RemoteRpcProviderRegistry.prototype.getProviderTopic = function( rpcName, callback ) {
	if( this._hasProviderForRpcName( rpcName ) ) {
		callback( null, this._providerCollections[ rpcName ].getRandomProvider() );
	} else {
		this.once( this._providerAvailableEvent + rpcName, callback );
		this._queryProviders( rpcName );
	}
};

/**
 * Returns an array of all currently available provider topics for a specific rpcName
 * without re-requesting them
 *
 * @param {String} rpcName
 *
 * @public
 * @returns {Array} providerTopics
 */
RemoteRpcProviderRegistry.prototype.getAllProviderTopics = function( rpcName ) {
	if( this._hasProviderForRpcName( rpcName ) ) {
		return this._providerCollections[ rpcName ].getAll();
	}
	else {
		return [];
	}
};

/**
 * Gate for incoming rpc messages. The only action
 * that's processed by this class is PROVIDER_UPDATE, all
 * other messages will be handled by other classes
 *
 * @param   {Object} msg message from messageConnector
 *
 * @private
 * @returns {void}
 */
RemoteRpcProviderRegistry.prototype._processRpcMessage = function( msg ) {
	if( msg.action === C.ACTIONS.PROVIDER_UPDATE ) {
		this._onProviderUpdate( msg.data );
	}
};

/**
 * Receives an array with one or more provider registrations
 * and add them to the registry.
 *
 * This method will be called in response to a provider query message,
 * but can also be called randomly when other deepstream instances decide
 * to send out an update of their rpc providers
 *
 * @param   {Array} providerDataList A list of providerData maps. See _addProvider below
 *
 * @private
 * @returns {void}
 */
RemoteRpcProviderRegistry.prototype._onProviderUpdate = function( providerDataList ) {
	for( var i = 0; i < providerDataList.length; i++ ) {
		this._addProvider( providerDataList[ i ].rpcName, providerDataList[ i ] );
	}
};

/*
 * Adds an individual provider to this registry as a result of a PROVIDER_UPDATE
 * message from the message connector.
 *
 * Providers for a specific RPC are stored in a RpcProviderCollection.
 * If no RpcProviderCollection exists yet for the rpcName, a new one will be created.
 *
 * This method also clears any pending query timeouts for <rpcName>
 *
 * @param	{String} rpcName
 * @param   {Object} providerData {
 *                                	numberOfProviders: <Number>
									privateTopic: <String>
									rpcName: <String>
 *                                }
 *
 * @private
 * @returns {void}
 */
RemoteRpcProviderRegistry.prototype._addProvider = function( rpcName, providerData ) {
	if( !this._providerCollections[ rpcName ] ) {
		this._providerCollections[ rpcName ] = new RpcProviderCollection( this._options );
	}

	this._providerCollections[ rpcName ].addProvider( providerData );

	if( this._queryTimeouts[ rpcName ] !== undefined ) {
		clearTimeout( this._queryTimeouts[ rpcName ] );
		delete this._queryTimeouts[ rpcName ];
	}

	var event = this._providerAvailableEvent + rpcName,
		error = null,
		remoteUrl = this._providerCollections[ rpcName ].getRandomProvider();

	this.emit( event, error, remoteUrl );
};

/**
 * Checks if there are already registered remote providers for <rpcName> and if
 * their registration hasn't expired.
 *
 * @param   {String}  rpcName
 *
 * @private
 * @returns {Boolean} has providers
 */
RemoteRpcProviderRegistry.prototype._hasProviderForRpcName = function( rpcName ) {
	return this._providerCollections[ rpcName ] && this._providerCollections[ rpcName ].isUpToDate();
};

/**
 * Sends a provider query message to all listening deepstream instances. Clears down any
 * provider registrations for <rpcName> and starts a timeout after which the query will
 * fail if no PROVIDER_UPDATES had been received
 *
 * If there's already a provider query in flight, this method won't do anything.
 *
 * @param   {String}   rpcName
 *
 * @private
 * @returns {void}
 */
RemoteRpcProviderRegistry.prototype._queryProviders = function( rpcName ) {

	/*
	 * Query for rpcName is already in flight
	 */
	if( this._queryTimeouts[ rpcName ] !== undefined ) {
		return;
	}

	/*
	 * Delete existing provider collection
	 */
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

/**
 * Callback that will be invoked if a provider query hadn't received
 * any results within a configured timeframe. At this point we'll
 * assume that no provider, whether local or remote, can provide
 * the rpc the client requested.
 *
 * Will invoke tha callback with an error which in turn will notify
 * all clients waiting for <rpcName> that no provider is available.
 *
 * @param   {String} rpcName
 *
 * @private
 * @returns {void}
 */
RemoteRpcProviderRegistry.prototype._onProviderQueryTimeout = function( rpcName ) {
	delete this._queryTimeouts[ rpcName ];
	this.emit( this._providerAvailableEvent + rpcName, C.EVENT.NO_RPC_PROVIDER );
};

module.exports = RemoteRpcProviderRegistry;
