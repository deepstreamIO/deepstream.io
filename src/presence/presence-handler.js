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
		this._connectedClients = new DistributedStateRegistry( C.TOPIC.PRESENCE, options );
		this._connectedClients.on( 'add', this._onClientAdded.bind( this ) );
		this._connectedClients.on( 'remove', this._onClientRemoved.bind( this ) );
	}

	/**
	 * The main entry point to the presence handler class.
	 * Called on any of the following actions:
	 *
	 * 1) C.ACTIONS.PRESENCE_JOIN
	 * 2) C.ACTIONS.PRESENCE_LEAVE
	 * 3) C.ACTIONS.SUBSCRIBE
	 *		a) C.ACTIONS.PRESENCE_JOIN
	 *		b) C.ACTIONS.PRESENCE_LEAVE
	 * 4) C.ACTIONS.QUERY
	 *
	 * @param   {SocketWrapper} socketWrapper the socket that send the request
	 * @param   {Object} message parsed and validated message
	 *
	 * @public
	 * @returns {void}
	 */
	handle( socketWrapper, message ) {
		if( !socketWrapper.user ) {
			return;
		}

		if ( message.action === C.ACTIONS.PRESENCE_JOIN ) {
			this._connectedClients.add( socketWrapper.user );
		} 
		else if ( message.action === C.ACTIONS.PRESENCE_LEAVE ) {
			this._connectedClients.remove( socketWrapper.user );
		}
		else if( message.action === C.ACTIONS.SUBSCRIBE ) {
			if( message.data[ 0 ] === C.ACTIONS.PRESENCE_JOIN ) {
				this._presenceRegistry.subscribe( C.ACTIONS.PRESENCE_JOIN, socketWrapper );
			}
			else if( message.data[ 0 ] === C.ACTIONS.PRESENCE_LEAVE ) {
				this._presenceRegistry.subscribe( C.ACTIONS.PRESENCE_LEAVE, socketWrapper );
			}
			else {
				//todo
				throw new Error('Wrong action')
			}
			
		}
		else if( message.action === C.ACTIONS.QUERY ) {	
			socketWrapper.sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.ACK, [ C.TOPIC.PRESENCE, C.ACTIONS.QUERY ] );
			var clients = this._connectedClients.getAll();
			socketWrapper.sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients );
		}
	}

	/**
	 * Alerts all clients who are subscribed to
	 * PRESENCE_JOIN that a new client has been added.
	 * 
	 * @param   {String} username the username of the client that joined
	 *
	 * @public
	 * @returns {void}
	 */
	_onClientAdded( username ) {
		var addMsg = messageBuilder.getMsg( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_JOIN, [ username ] );
		this._presenceRegistry.sendToSubscribers( C.ACTIONS.PRESENCE_JOIN, addMsg );
	}

	/**
	 * Alerts all clients who are subscribed to
	 * PRESENCE_LEAVE that the client has left.
	 * 
	 * @param   {String} username the username of the client that left
	 *
	 * @public
	 * @returns {void}
	 */
	_onClientRemoved( username, socketWrapper ) {
		var rmMsg = messageBuilder.getMsg( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_LEAVE, [ username ] );
		this._presenceRegistry.sendToSubscribers( C.ACTIONS.PRESENCE_LEAVE, rmMsg );
	}
}