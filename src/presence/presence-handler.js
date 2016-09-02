'use strict';

var C = require( '../constants/constants' ),
	DistributedStateRegistry = require( '../cluster/distributed-state-registry' ),
	messageBuilder = require( '../message/message-builder' ),
	messageParser = require( '../message/message-parser' );


module.exports = class PresenceHandler {

	constructor( options ) {
		this._options = options;
		this._loggedInClients = new DistributedStateRegistry( C.TOPIC.PRESENCE, this._options );
		this._loggedInClients.on( 'add', this._onClientAdded.bind( this ) );
		this._loggedInClients.on( 'remove', this._onClientRemoved.bind( this ) );
	}

	handle( socketWrapper, message ) {

		if ( message.action === C.ACTIONS.PRESENCE_ADD ) {
			this._loggedInClients.add( messageParser.convertTyped( message.data[ 0 ] ) );
		} 
		else if ( message.action === C.ACTIONS.PRESENCE_REMOVE ) {
			this._loggedInClients.remove( messageParser.convertTyped( message.data[ 0 ] ) );
		}
		else if( message.action === C.ACTIONS.QUERY ) {			
			var clients = this._loggedInClients.getAll();
			socketWrapper.sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.QUERY, clients );
		}
	}

	_onClientAdded( username ) {
		console.log( username, 'has been added' );
	}

	_onClientRemoved( username ) {
		console.log( username, 'has been removed' );
	}
}