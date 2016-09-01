'use strict';

var C = require( '../constants/constants' ),
	DistributedStateRegistry = require( '../cluster/distributed-state-registry' );


module.exports = class PresenceHandler {

	constructor( options ) {
		this._options = options;
		this._distributedStateRegistry = new DistributedStateRegistry( C.TOPIC.PRESENCE, this._options );
	}


	handle( socketWrapper, message ) {

		if( message.action === C.ACTIONS.PRESENCE_ADD ) {
			console.log('Adding client', message.data[0]);
			this._distributedStateRegistry.add( message.data[ 0 ] );
			//todo alert clients
		}

		else if( message.action === C.ACTIONS.PRESENCE_REMOVE ) {
			console.log('Removing client', message.data[0]);
			this._distributedStateRegistry.remove( message.data[ 0 ] );
			//todo alert clients
		}
	}
}
