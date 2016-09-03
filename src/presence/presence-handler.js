'use strict';

var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	DistributedStateRegistry = require( '../cluster/distributed-state-registry' ),
	messageBuilder = require( '../message/message-builder' ),
	messageParser = require( '../message/message-parser' );


module.exports = class PresenceHandler {

	constructor( options, connectionEndpoint ) {
		this._options = options;
		this._connectionEndpoint = connectionEndpoint;
		this._presenceRegistry = new SubscriptionRegistry( options, C.TOPIC.PRESENCE );
		this._presenceRegistry.setAction( 'subscribe', C.ACTIONS.PRESENCE_ADD );
		this._presenceRegistry.setAction( 'unsubscribe', C.ACTIONS.PRESENCE_REMOVE );
		this._presenceRegistry.setSubscriptionListener( {
			onSubscriptionRemoved: this._onClientRemoved.bind( this ),
			onSubscriptionMade: this._onClientAdded.bind( this )
		} );

		this._connectedClients = new DistributedStateRegistry( C.TOPIC.PRESENCE, options );
	}

	handle( socketWrapper, message ) {
		if ( message.action === C.ACTIONS.PRESENCE_ADD ) {
			this._connectedClients.add( socketWrapper.user );
		} 
		else if ( message.action === C.ACTIONS.PRESENCE_REMOVE ) {
			this._connectedClients.remove( socketWrapper.user )
		}
		else if( message.action === C.ACTIONS.SUBSCRIBE ) {
			if( message.data[ 0 ] === C.ACTIONS.PRESENCE_ADD ) {
				console.log('Subsciring client')
				this._presenceRegistry.subscribe( C.TOPIC.PRESENCE_ADD, socketWrapper );
			}
			else if( message.data[ 0 ] === C.ACTIONS.PRESENCE_REMOVE ) {
				this._presenceRegistry.subscribe( C.TOPIC.PRESENCE_REMOVE, socketWrapper );
			}
			else {
				console.log('ERRR incorrect subscription')
				//socketWrapper.sendError
			}
			
		}
		else if( message.action === C.ACTIONS.QUERY ) {			
			var clients = this._connectedClients.getAll();
			socketWrapper.sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients );
		}
	}

	_onClientAdded( topic, socketWrapper, count ) {
		console.log('CLIENT ADDED', socketWrapper.user, count)
		var addMsg = messageBuilder.getMsg( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_ADD, [ socketWrapper.user ] );
		this._presenceRegistry.sendToSubscribers( C.TOPIC.PRESENCE, addMsg, socketWrapper );
	}

	_onClientRemoved( topic, socketWrapper, count ) {
		console.log('CLIENT REMOVED', socketWrapper.user)
		var rmMsg = messageBuilder.getMsg( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_REMOVE, [ socketWrapper.user ] );
		this._presenceRegistry.sendToSubscribers( C.TOPIC.PRESENCE, rmMsg, socketWrapper );
	}
}