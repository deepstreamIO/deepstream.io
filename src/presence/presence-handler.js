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
		if ( message.action === C.ACTIONS.PRESENCE_JOIN ) {
			if( socketWrapper.user !== null ) {
				this._connectedClients.add( socketWrapper.user );
			} else {
				//TODO: Can this ever be reached in non test situations?
				this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, 'missing username' );
			}
		}
		else if ( message.action === C.ACTIONS.PRESENCE_LEAVE ) {
			this._handleLeave( socketWrapper );
		}
		else if( message.action === C.ACTIONS.SUBSCRIBE ) {
			this._handleSubscribe( socketWrapper, message.data[ 0 ] );
		}
		else if( message.action === C.ACTIONS.QUERY ) {
			socketWrapper.sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.ACK, [ C.TOPIC.PRESENCE, C.ACTIONS.QUERY ] );
			const clients = this._connectedClients.getAll();
			const index = clients.indexOf( socketWrapper.user );
			if( index !== -1 ) {
				clients.splice( index, 1 );
			}
			socketWrapper.sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients );
		}
		else {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );

			if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
				socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
			}
		}
	}

	/**
	 * Removes subscriptions to presence events and removes them from the
	 * _connectedClients list
	 *
	 * @param   {Object} socketWrapper the socketWrapper of the client that left
	 *
	 * @public
	 * @returns {void}
	 */
	_handleLeave( socketWrapper ) {
		this._presenceRegistry.unsubscribe( C.ACTIONS.PRESENCE_JOIN, socketWrapper, true );
		this._presenceRegistry.unsubscribe( C.ACTIONS.PRESENCE_LEAVE, socketWrapper, true );
		this._connectedClients.remove( socketWrapper.user );
	}

	/**
	 * Handles subscriptions to client login and logout events
	 *
	 * @param   {Object} socketWrapper the socketWrapper of the client that left
	 * @param   {String} actions either a subscribe or unsubscribe message
	 *
	 * @public
	 * @returns {void}
	 */
	_handleSubscribe( socketWrapper, action ) {
		if( action === C.ACTIONS.PRESENCE_JOIN ) {
				this._presenceRegistry.subscribe( C.ACTIONS.PRESENCE_JOIN, socketWrapper );
		}
		else if( action === C.ACTIONS.PRESENCE_LEAVE ) {
			this._presenceRegistry.subscribe( C.ACTIONS.PRESENCE_LEAVE, socketWrapper );
		}
		else {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, action );

			if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
				socketWrapper.sendError( C.TOPIC.EVENT, C.EVENT.INVALID_MESSAGE_DATA, 'unknown data ' + action );
			}
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
	_onClientRemoved( username ) {
		var rmMsg = messageBuilder.getMsg( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_LEAVE, [ username ] );
		this._presenceRegistry.sendToSubscribers( C.ACTIONS.PRESENCE_LEAVE, rmMsg );
	}
}