'use strict'

const messageBuilder = require( '../message/message-builder' );
const C = require( '../constants/constants' );

class ListenerTimeoutRegistry {
	/**
	 * The ListenerTimeoutRegistry is responsible for keeping track of listeners that have
	 * been asked whether they want to provide a certain subscription, but have not yet
	 * responded.
	 *
	 * @param {Topic} type
	 * @param {Map} options
	 */
	constructor( type, options ) {
		this._type = type;
		this._options = options;
		this._timeoutMap = {};
		this._timedoutProviders = {};
		this._acceptedProvider = {};
	}

	/**
	* The main entry point, which takes a message from a provider
	* that has already timed out and does the following:
	*
	* 1) If reject, remove from map
	* 2) If accept, store as an accepted and reject all following accepts
	*/
	handle( socketWrapper, message ) {
		const pattern = message.data[ 0 ];
		const subscriptionName = message.data[ 1 ];
		const index = this._getIndex( socketWrapper, message );
		const provider = this._timedoutProviders[ subscriptionName ][ index ];
		if( message.action === C.ACTIONS.LISTEN_ACCEPT ) {
			if( !this._acceptedProvider[ subscriptionName ] ) {
				this._acceptedProvider[ subscriptionName ] = this._timedoutProviders[ subscriptionName ][ index ];
			} else {
				provider.socketWrapper.send(
					messageBuilder.getMsg(
						this._type,
						C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
						[ provider.pattern, subscriptionName ]
					)
				)
			}
		} else if ( message.action === C.ACTIONS.LISTEN_REJECT ) {
			this._timedoutProviders[ subscriptionName ].splice( index, 1 );
		}
	}

/**
	* Clear cache once discovery phase is complete
	* @private
	*/
	clear( subscriptionName ) {
		delete this._timeoutMap[ subscriptionName ];
		delete this._timedoutProviders[ subscriptionName ];
		delete this._acceptedProvider[ subscriptionName ];
	}

	/**
	* Called whenever a provider closes to ensure cleanup
	* @private
	*/
	removeProvider( socketWrapper ) {
		for( var acceptedProvider in this._acceptedProvider ) {
			if( this._acceptedProvider[ acceptedProvider ].socketWrapper === socketWrapper ) {
				delete this._acceptedProvider[ acceptedProvider ];
			}
		}
		for( var subscriptionName in this._timeoutMap ) {
			if( this._timeoutMap[ subscriptionName ] ) {
				this.clearTimeout( subscriptionName );
			}
		}
	}

	/**
	* Start a timeout for a provider. If it doesn't respond within
	* it trigger the callback to process with the next listener.
	* If the provider comes back after the timeout with a reject,
	* ignore it, if it comes back with an accept and no other listener
	* accepted yet, wait for the next listener response or timeout,
	* if a reject just remove, if an accept and another provider already
	* accepted, then send it an immediate SUBSCRIPTION_REMOVED message.
	*
	* @public
	*/
	addTimeout( subscriptionName, provider, callback ) {
		var timeoutId = setTimeout( () => {
			if (this._timedoutProviders[ subscriptionName ] == null ) {
				this._timedoutProviders[ subscriptionName ] = [];
			}
			this._timedoutProviders[ subscriptionName ].push( provider );
			callback( subscriptionName );
		}, this._options.listenResponseTimeout );
		this._timeoutMap[ subscriptionName ] = timeoutId;
	}

	/**
	* Clear the timeout for a LISTEN_ACCEPT or LISTEN_REJECt recieved
	* by the listen registry
	*
	* @public
	*/
	clearTimeout( subscriptionName ) {
		clearTimeout( this._timeoutMap[ subscriptionName ] );
		delete this._timeoutMap[ subscriptionName ];
	}

	/**
	* Return if the socket is a provider that previously timeout
	*
	* @public
	*/
	isALateResponder( socketWrapper, message ) {
		const index = this._getIndex( socketWrapper, message )
		return this._timedoutProviders[ message.data[ 1 ] ] && index !== -1;
	}

	/**
	* Return if the socket is a provider that previously timeout
	*
	* @public
	*/
	rejectLateResponderThatAccepted( subscriptionName ) {
		const provider = this._acceptedProvider[ subscriptionName ];
		if( provider ) {
			provider.socketWrapper.send(
				messageBuilder.getMsg(
					this._type,
					C.ACTIONS.SUBSCRIPTION_FOR_PATTERN_REMOVED,
					[ provider.pattern, subscriptionName ]
				)
			)
		}
	}

	/**
	* Return if the socket is a provider that previously timeout
	*
	* @public
	*/
	getLateResponderThatAccepted( subscriptionName ) {
		return this._acceptedProvider[ subscriptionName ];
	}

	/**
	* Return if the socket is a provider that previously timeout
	*
	* @private
	*/
	_getIndex( socketWrapper, message ) {
		const pattern = message.data[ 0 ];
		const subscriptionName = message.data[ 1 ];
		const timedoutProviders = this._timedoutProviders[ subscriptionName ];

		for( var i=0; timedoutProviders && i < timedoutProviders.length; i++ ) {
			if( timedoutProviders[ i ].socketWrapper === socketWrapper && timedoutProviders[ i ].pattern === pattern ) {
				return i;
			}
		}

		return -1;
	}

}


module.exports = ListenerTimeoutRegistry;
