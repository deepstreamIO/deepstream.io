'use strict';

const C = require( '../constants/constants' );
const SubscriptionRegistry = require( '../utils/subscription-registry' );
const Rpc = require( './rpc' );
const RpcProxy = require( './rpc-proxy' );
const utils = require( '../utils/utils' );

module.exports = class RpcHandler {
	/**
	* Handles incoming messages for the RPC Topic.
	*
	* @param {Object} options deepstream options
	*/
	constructor( options ) {
		this._options = options;
		this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RPC );

		this._privateTopic = C.TOPIC.PRIVATE + this._options.serverName;
		this._options.messageConnector.subscribe( this._privateTopic, this._onPrivateMessage.bind( this ) );

		this._supportedSubActions = [
			C.ACTIONS.RESPONSE,
			C.ACTIONS.ACK,
			C.ACTIONS.REJECTION,
			C.ACTIONS.ERROR
		];

		/**
		 * {
		 * 	'xxx' : {
		 *		local: [],
		 *		remoteServers: [],
		 *		rpcProxy: null,
		 *		rpc: null
		 * 	}
		 */
		this._rpcs = {};
	}

	/**
	 * Main interface. Handles incoming messages
	 * from the message distributor
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {Object} message parsed and validated deepstream message
	 *
	 * @public
	 * @returns {void}
	 */
	handle( socketWrapper, message ) {

		if( message.action === C.ACTIONS.SUBSCRIBE ) {
			this._registerProvider( socketWrapper, message );
		}

		else if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
			this._unregisterProvider( socketWrapper, message );
		}

		else if( message.action === C.ACTIONS.REQUEST ) {
			this._makeRpc( socketWrapper, message );
		}

		else if( this._supportedSubActions.indexOf( message.action ) > -1 ) {
			const rpcData = this._rpcs[ message.data[ 1 ] ];
			if( rpcData ) {
				rpcData.rpc.handle( message );
				if( rpcData.rpc.isComplete ) {
					delete this._rpcs[ message.data[ 1 ] ];
				}
			}
			else {
				// unsoliciated message
				socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, 'unexpected state for rpc ' + message.data[ 1 ] + ' with action ' + message.action );
			}
		}

		/*
		 * RESPONSE-, ERROR-, REJECT- and ACK messages from the provider are processed
		 * by the Rpc class directly
		 */
		else {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );

			if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
				socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
			}
		}
	}

	/**
	 * This method is called by Rpc to reroute its request
	 *
	 * If a provider is temporarily unable to service a request, it can reject it. Deepstream
	 * will then try to reroute it to an alternative provider. Finding an alternative provider
	 * happens in this method.
	 *
	 * Initially, deepstream will look for a local provider that hasn't been used by the RPC yet.
	 * If non can be found, it will go through the currently avaiblable remote providers and try find one that
	 * hasn't been used yet. Please note: It will not make another request for remote providers, based on
	 * the assumption that they are still up to date from the original rpc.
	 *
	 * If a remote provider couldn't be found or all remote-providers have been tried already
	 * this method will return null - which in turn will prompt the RPC to send a NO_RPC_PROVIDER
	 * error to the client and destroy itself
	 *
	 * @param {String} 	rpcName
	 * @param {String}	correlationId
	 *
	 * @public
	 * @returns {SocketWrapper|RpcProxy} alternativeProvider
	 */
	getAlternativeProvider( rpcName, correlationId ) {
		const rpcData = this._rpcs[ correlationId ];
		const usedRemoteProviderTopics = [];
		const localProviders = this._subscriptionRegistry.getLocalSubscribers( rpcName );

		var allRemoteProviderTopics;

		/*
		 * Look within the local providers for one that hasn't been used yet
		 */
		if( rpcData.local.length > 0 ) {
			return this._getNextRandomLocalProvider( correlationId );
		}

		/*
		 * Get a list of the private topics of all remote providers
		 */
		allRemoteProviderTopics = rpcData.remoteServers;

		/**
		 * Do any remote topics exist? If not, this is already from another
		 * server so we shouldn't try making a remote request.
		 */
		if( typeof allRemoteProviderTopics === "undefined" ) {
			return null;
		}

		/*
		 * No local or remote providers to service the request? Return here
		 */
		if( allRemoteProviderTopics.length === 0 ) {
			return null;
		}

		/*
		 * Search for a remote provider that hasn't been used yet
		 */
		return new RpcProxy( this._options, allRemoteProviderTopics[ 0 ], rpcName, correlationId );
	}

	/**
	 * Callback for subscription messages. Registers
	 * a client as a provider for specific remote
	 * procedure calls as identified by <rpcName>
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {Object} message parsed and validated deepstream message
	 *
	 * @private
	 * @returns {void}
	 */
	_registerProvider( socketWrapper, message ) {
		if( this._isValidMessage( 1, socketWrapper, message ) ) {
			this._subscriptionRegistry.subscribe( message.data[ 0 ], socketWrapper );
		}
	}

	/**
	 * Callback for unsubscribe messages. Removes
	 * a client as a provider for specific remote
	 * procedure calls as identified by <rpcName>
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {Object} message parsed and validated deepstream message
	 *
	 * @private
	 * @returns {void}
	 */
	_unregisterProvider( socketWrapper, message ) {
		if( this._isValidMessage( 1, socketWrapper, message ) ) {
			this._subscriptionRegistry.unsubscribe( message.data[ 0 ], socketWrapper );
		}
	}

	/**
	 * Executes a RPC. If there are clients connected to
	 * this deepstream instance that can provide the rpc, it
	 * will be routed to a random one of them, otherwise it will be routed
	 * to the message connector
	 *
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {Object} message parsed and validated deepstream message
	 *
	 * @private
	 * @returns {void}
	 */
	_makeRpc( socketWrapper, message, source ) {
		if( !this._isValidMessage( 2, socketWrapper, message ) ) {
			return;
		}

		const rpcName = message.data[ 0 ];
		const correlationId = message.data[ 1 ];
		var	makeRemoteRpcFn, provider;

		const rpcData = {
			local: this._subscriptionRegistry.getLocalSubscribers( rpcName ),
			remoteServers: null,
			rpc: null,
			rpc: null
		};
		this._rpcs[ correlationId ] = rpcData;

		if( source !== C.SOURCE_MESSAGE_CONNECTOR ) {
			const serverNames = this._subscriptionRegistry.getAllRemoteServers( rpcName );
			rpcData.remoteServers = serverNames;
		}

		//TODO see null
		if( rpcData.local.length > 0 ) {
			provider = this._getNextRandomLocalProvider( correlationId );
			rpcData.rpc = new Rpc( this, socketWrapper, provider, this._options, message );
		}
		else if( source === C.SOURCE_MESSAGE_CONNECTOR ) {
			socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [ rpcName, correlationId ] );
		}
		else {
			this._makeRemoteRpc( this, socketWrapper, message );
		}
	}

	/**
	 * Callback to remoteProviderRegistry.getProviderProxy()
	 *
	 * If a remote provider is available this method will route the rpc to it.
	 *
	 * If no remote provider could be found this class will return a
	 * NO_RPC_PROVIDER error to the requestor. The RPC won't continue from
	 * thereon
	 *
	 * @param   {SocketWrapper} requestor
	 * @param   {Object} message   RPC Request message
	 * @param   {String} error     null if remote providers are availabe, otherwise one of C.EVENT
	 * @param   {ProviderProxy} provider
	 *
	 * @private
	 * @returns {void}
	 */
	_makeRemoteRpc( requestor, message ) {
		const rpcName = message.data[ 0 ];
		const correlationId = message.data[ 1 ];
		const rpcData = this._rpcs[ correlationId ];

		if( this._remoteRPCServers[ correlationId ].length > 0 ) {
			rpcData.rpc = new RpcProxy( this._options, this._getNextRandomServer( correlationId ), rpcName, correlationId );
			rpcData.rpc = new Rpc( this, requestor, providerProxy, this._options, message );
			return;
		}

		delete this._remoteRPCServers[ correlationId ];

		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.NO_RPC_PROVIDER, rpcName );

		if( requestor !== C.SOURCE_MESSAGE_CONNECTOR ) {
			requestor.sendError( C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [ rpcName, correlationId ] );
		}
	}

	/**
	 * Callback for messages that are send directly to
	 * this deepstream instance.
	 *
	 * Please note: Private messages are generic, so the RPC
	 * specific ones need to be filtered out.
	 *
	 * @param   {Object} msg
	 *
	 * @private
	 * @returns {void}
	 */
	_onPrivateMessage( msg ) {

		if( msg.originalTopic !== C.TOPIC.RPC ) {
			return;
		}

		if( !message.data || message.data.length < 2 ) {
			// Log an error
			return;
		}

		msg.topic = msg.originalTopic;

		if( msg.action === C.ACTIONS.REQUEST ) {
			const proxy = new RpcProxy(
				this._options,
				msg.remotePrivateTopic,
				 msg.data[ 0 ],
				msg.data[ 1 ]
			);
			this._makeRpc( proxy, msg, C.SOURCE_MESSAGE_CONNECTOR );
		}
		else {
			this._rpcs[ correlationId ].rpc.processProviderMessage( msg );
		}

	}

	/**
	 * Checks if the incoming message is valid, e.g. if rpcName
	 * is present for subscribe / unsubscribe messages or if
	 * rpcName and correlationId is present for rpc calls.
	 *
	 * @param   {Number}  dataLength    The expected number of entries in the data array
	 * @param   {SocketWrapper} socketWrapper
	 * @param   {Object} message parsed and validated deepstream message
	 *
	 * @private
	 * @returns {Boolean} isValid
	 */
	_isValidMessage( dataLength, socketWrapper, message ) {
		if( message.data && message.data.length >= dataLength && typeof message.data[ 0 ] === 'string' ) {
			return true;
		}

		socketWrapper.sendError( C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return false;
	}

	/**
	 * @return {[type]}
	 */
	_getNextRandomLocalProvider( correlationId ) {
		const localProviders = this._rpcs[ correlationId ].local;
		const randomProviderIndex = utils.getRandomIntInRange( 0, localProviders.length );
		return localProviders.splice( randomProviderIndex, 1 )[ 0 ];
	}

	/**
	 * @return {[type]}
	 */
	_getNextRandomServer( correlationId ) {
		const remoteServers = this._rpcs[ correlationId ].remoteServers;
		const randomProviderIndex = utils.getRandomIntInRange( 0, remoteServers.length );
		return 'PRIVATE/' + remoteServers.splice( randomProviderIndex, 1 )[ 0 ];
	}
}
