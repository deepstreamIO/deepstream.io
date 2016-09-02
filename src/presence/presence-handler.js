'use strict';

var C = require( '../constants/constants' ),
	DistributedStateRegistry = require( '../cluster/distributed-state-registry' ),
	messageBuilder = require( '../message/message-builder' ),
	messageParser = require( '../message/message-parser' );


module.exports = class PresenceHandler {

	constructor( options, connectionEndpoint ) {
		this._options = options;
		this._connectionEndpoint = connectionEndpoint;
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
		var sockWrappers = this._connectionEndpoint.getAuthenticatedSockets();
		for (var i = sockWrappers.length - 1; i >= 0; i--) {
			if( sockWrappers[ i ].user !== 'OPEN' || sockWrappers[ i ].user !== username ) 
				sockWrappers[i].sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_ADD, [ username ] );
		}
	}

	_onClientRemoved( username ) {
		var sockWrappers = this._connectionEndpoint.getAuthenticatedSockets();
		for (var i = sockWrappers.length - 1; i >= 0; i--) {
			if( sockWrappers[ i ].user !== 'OPEN' || sockWrappers[ i ].user !== username ) 
				sockWrappers[i].sendMessage( C.TOPIC.PRESENCE, C.ACTIONS.PRESENCE_REMOVE, [ username ] );
		}
	}
}