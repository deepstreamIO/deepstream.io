'use strict';

const C = require( '../constants/constants' );
const SubscriptionRegistry = require( '../utils/subscription-registry' );
const DistributedStateRegistry = require( '../cluster/distributed-state-registry' );
const messageBuilder = require( '../message/message-builder' );

/**
 * This class handles incoming and outgoing messages in relation
 * to deepstream presence. It provides a way to inform clients
 * who else is logged into deepstream
 *
 * @param {Object} options    deepstream options
 * @param {Connection} connection
 * @param {Client} client
 * @public
 * @constructor
 */
module.exports = class PresenceHandler {

	constructor( options ) {
		this._options = options;

		this._connectionEndpoint = options.connectionEndpoint;
		this._connectionEndpoint.on( 'client-connected', this._handleJoin.bind( this ) );
		this._connectionEndpoint.on( 'client-disconnected', this._handleLeave.bind( this ) );

		this._presenceRegistry = new SubscriptionRegistry( options, C.TOPIC.PRESENCE );

		this._connectedClients = new DistributedStateRegistry( C.TOPIC.ONLINE_USERS, options );
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
		if( message.action === C.ACTIONS.SUBSCRIBE ) {
			this._handleSubscribe( socketWrapper, message.data[ 0 ] );
		}
		else if( message.action === C.ACTIONS.QUERY ) {
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
	 * Called whenever a client has succesfully logged in with a username
	 *
	 * @param   {Object} socketWrapper the socketWrapper of the client that logged in
	 *
	 * @private
	 * @returns {void}
	 */
	_handleJoin( socketWrapper ) {
		this._connectedClients.add( socketWrapper.user );
	}

	/**
	 * Called whenever a client has disconnected
	 *
	 * @param   {Object} socketWrapper the socketWrapper of the client that disconnected
	 *
	 * @private
	 * @returns {void}
	 */
	_handleLeave( socketWrapper ) {
		this._connectedClients.remove( socketWrapper.user );
	}

	/**
	 * Handles subscriptions to client login and logout events
	 *
	 * @param   {Object} socketWrapper the socketWrapper of the client that left
	 * @param   {String} actions either a subscribe or unsubscribe message
	 *
	 * @private
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
	 * @private
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
	 * @private
	 * @returns {void}
	 */
	_onClientRemoved( username ) {
		var removeMsg = messageBuilder.getMsg( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_LEAVE, [ username ] );
		this._presenceRegistry.sendToSubscribers( C.ACTIONS.PRESENCE_LEAVE, removeMsg );
	}

}