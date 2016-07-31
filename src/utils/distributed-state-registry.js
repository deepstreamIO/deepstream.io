'use strict';

const EventEmitter = require( 'events' ).EventEmitter;
const C = require( '../constants/constants' );
const DATA_LENGTH = {};

DATA_LENGTH[ C.EVENT.DISTRIBUTED_STATE_REQUEST_FULL_STATE ] = 1;
DATA_LENGTH[ C.EVENT.DISTRIBUTED_STATE_FULL_STATE ] = 2;
DATA_LENGTH[ C.EVENT.DISTRIBUTED_STATE_ADD ] = 3;
DATA_LENGTH[ C.EVENT.DISTRIBUTED_STATE_REMOVE ] = 3;

module.exports = class DistributedStateRegistry extends EventEmitter{
	constructor( topic, options ) {
		super();
		this._topic = topic;
		this._options = options;
		this._options.messageConnector.subscribe( topic, this._processIncomingMessage.bind( this ) );
		this._data = {};
		this._reconciliationTimeouts = {};
	}

	add( name ) {
		if( !this._has( name, this._options.serverName ) ) {
			this._add( name, this._options.serverName );
			this._sendMessage( name, C.EVENT.DISTRIBUTED_STATE_ADD );
		}
	}

	remove( name ) {
		if( this._has( name, this._options.serverName ) ) {
			this._remove( name, this._options.serverName );
			this._sendMessage( name, C.EVENT.DISTRIBUTED_STATE_REMOVE );
		}
	}

	removeAll( serverName ) {
		var name;
		for( name in this._data ) {
			if( this._data[ name ].nodes[ serverName ] ) {
				this._remove( name, serverName );
			}
		}
	}

	getAll() {
		return Object.keys( this._data );
	}

	_remove( name, serverName ) {
		var name, exists = false;

		if( !this._data[ name ] ) {
			return; //TODO Error?
		}

		this._data[ name ].nodes[ serverName ] = false;


		for( serverName in this._data[ name ].nodes ) {
			if( this._data[ name ].nodes[ serverName ] === true ) {
				exists = true;
			}
		}

		if( exists === false ) {
			delete this._data[ name ];
			this.emit( 'remove', name );
		}
	}

	_has( name, serverName ) {
		return this._data[ name ] && this._data[ name ].nodes[ serverName ];
	}

	_add( name, serverName ) {
		if( !this._data[ name ] ) {
			this._data[ name ] = {
				nodes: {},
				checkSum: this._createCheckSum( name )
			}
			this.emit( 'add', name );
		}

		this._data[ name ].nodes[ serverName ] = true;
	}

	_sendMessage( name, action ) {
		var message = {
			topic: this._topic,
			action: action,
			data: [ name, this._options.serverName, this._getLocalCheckSumTotal() ]
		};

		this._options.messageConnector.publish( this._topic, message );
	}

	_getLocalCheckSumTotal() {
		var totalCheckSum = 0, name;

		for( name in this._data ) {
			if( this._data[ name ].nodes[ this._options.serverName ] ) {
				totalCheckSum += this._data[ name ].checkSum;
			}
		}

		return totalCheckSum;
	}

	_createCheckSum( name ) {
		var checkSum = 0, i;

		for( i = 0; i < name.length; i++ ) {
			checkSum += name.charCodeAt( i );
		}

		return checkSum;
	}

	_reconcile( serverName ) {
		this._options.messageConnector.publish( this._topic, {
			topic: this._topic,
			action: C.EVENT.DISTRIBUTED_STATE_REQUEST_FULL_STATE,
			data: [ serverName ]
		});
	}

	_verifyCheckSum( serverName, remoteCheckSum ) {
		var localCheckSum = 0, name;

		for( name in this._data ) {
			if( this._data[ name ].nodes[ serverName ] ) {
				localCheckSum += this._data[ name ].checkSum;
			}
		}

		if( localCheckSum !== remoteCheckSum ) {
			this._reconciliationTimeouts[ serverName ] = setTimeout(
				this._reconcile.bind( this, serverName ),
				this._options.stateReconciliationTimeout
			);
		} else if( this._reconciliationTimeouts[ serverName ] ) {
			clearTimeout( this._reconciliationTimeouts[ serverName ] );
			delete this._reconciliationTimeouts[ serverName ];
		}
	}

	_sendFullState() {
		var localState = [], name;

		for( name in this._data ) {
			if( this._data[ name ].nodes[ serverName ] ) {
				localState.push( name );
			}
		}

		this._options.messageConnector.publish( this._topic, {
			topic: this._topic,
			action: C.EVENT.DISTRIBUTED_STATE_FULL_STATE,
			data: [ this._options.serverName, localState ]
		});
	}

	_applyFullState( serverName, names ) {
		var name, i;

		for( name in this._data ) {
			// this is sufficient as the registry will just set node[serverName] to false,
			// even if it doesn't exist yet
			if( names.indexOf( name ) === -1 ) {
				this._remove( name, serverName );
			}
		}

		for( i = 0; i < names.length; i++ ) {
			this._add( names[ i ], serverName );
		}
	}

	_processIncomingMessage( message ) {
		if( !this._isValidMessage( message ) ) {
			return;
		}

		if( message.action === C.EVENT.DISTRIBUTED_STATE_ADD ) {
			this._add( message.data[ 0 ], message.data[ 1 ] );
			this._verifyCheckSum( message.data[ 1 ], message.data[ 2 ] );
		}

		else if( message.action === C.EVENT.DISTRIBUTED_STATE_REMOVE ) {
			this._remove( message.data[ 0 ], message.data[ 1 ] );
			this._verifyCheckSum( message.data[ 1 ], message.data[ 2 ] );
		}

		else if( message.action === C.EVENT.DISTRIBUTED_STATE_REQUEST_FULL_STATE ) {
			if( message.data[ 0 ] === this._options.serverName ) {
				this._sendFullState();
			}
		}

		else if( message.action === C.EVENT.DISTRIBUTED_STATE_FULL_STATE ) {
			this._applyFullState( message.data[ 0 ], message.data[ 1 ] );
		}
	}

	_isValidMessage( message ) {
		if( DATA_LENGTH[ message.action ] === undefined ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );
			return false;
		}

		if( message.data.length !== DATA_LENGTH[ message.action ] ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data );
			return false;
		}

		return true;
	}
}