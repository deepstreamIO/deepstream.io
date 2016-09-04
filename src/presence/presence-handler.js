'use strict';

var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	DistributedStateRegistry = require( '../cluster/distributed-state-registry' ),
	messageBuilder = require( '../message/message-builder' ),
	messageParser = require( '../message/message-parser' );


module.exports = class PresenceHandler {

	constructor( options ) {
		this._options = options;
		this._connectionEndpoint = options.connectionEndpoint;
		this._presenceRegistry = new SubscriptionRegistry( options, C.TOPIC.PRESENCE );
		//this._presenceRegistry.setAction( 'subscribe', C.ACTIONS.PRESENCE_JOIN );
		//this._presenceRegistry.setAction( 'unsubscribe', C.ACTIONS.PRESENCE_LEAVE );
		//this._presenceRegistry.setSubscriptionListener( {
		//	onSubscriptionRemoved: this._onClientRemoved.bind( this ),
		//	onSubscriptionMade: this._onClientAdded.bind( this )
		//} );

		this._connectedClients = new DistributedStateRegistry( C.TOPIC.PRESENCE, options );
	}

	handle( socketWrapper, message ) {
		if( !socketWrapper.user || socketWrapper.user === 'OPEN' ) {
			console.log('nulling')
			return;
		}

		if ( message.action === C.ACTIONS.PRESENCE_JOIN ) {
			console.log(socketWrapper.user, 'joining')
			this._connectedClients.add( socketWrapper.user );
			this._onClientAdded( socketWrapper );
		} 
		else if ( message.action === C.ACTIONS.PRESENCE_LEAVE ) {
			this._connectedClients.remove( socketWrapper.user )
		}
		else if( message.action === C.ACTIONS.SUBSCRIBE ) {
			if( message.data[ 0 ] === C.ACTIONS.PRESENCE_JOIN ) {
				console.log( socketWrapper.user, 'subscribing to logins')
				this._presenceRegistry.subscribe( C.ACTIONS.PRESENCE_JOIN, socketWrapper );
			}
			else if( message.data[ 0 ] === C.ACTIONS.PRESENCE_LEAVE ) {
				console.log( socketWrapper.user, 'subscribing to logouts')
				this._presenceRegistry.subscribe( C.ACTIONS.PRESENCE_LEAVE, socketWrapper );
			}
			else {
				throw new Error('Wrong action')
			}
			
		}
		else if( message.action === C.ACTIONS.QUERY ) {	
			socketWrapper.sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.ACK, [ C.ACTIONS.QUERY ] );
			var clients = this._connectedClients.getAll();
			socketWrapper.sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients );
		}
	}

	_onClientAdded( socketWrapper ) {
		console.log('Notifying that', socketWrapper.user, 'joined')
		var addMsg = messageBuilder.getMsg( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_JOIN, [ socketWrapper.user ] );
		this._presenceRegistry.sendToSubscribers( C.ACTIONS.PRESENCE_JOIN, addMsg, socketWrapper );
	}

	_onClientRemoved( topic, socketWrapper, count ) {
		console.log('Notifying that', socketWrapper.user, 'left')
		var rmMsg = messageBuilder.getMsg( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_LEAVE, [ socketWrapper.user ] );
		this._presenceRegistry.sendToSubscribers( C.ACTIONS.PRESENCE_LEAVE, rmMsg, socketWrapper );
	}
}