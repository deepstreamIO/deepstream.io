'use strict';

const C = require( '../constants/constants' );
const utils = require( '../utils/utils' );
const EventEmitter = require( 'events' ).EventEmitter;
const SUPPORTED_ACTIONS = {};

SUPPORTED_ACTIONS[ C.ACTIONS.LOCK_RESPONSE ] = true;
SUPPORTED_ACTIONS[ C.ACTIONS.LOCK_REQUEST ] = true;
SUPPORTED_ACTIONS[ C.ACTIONS.LOCK_RELEASE ] = true;

/**
 * Uses options
 *      lockTimeout
 *      lockRequestTimeout
 *
 * Uses topics
 * 	    C.TOPIC.LEADER
 * 	    C.TOPIC.LEADER_PRIVATE_<serverName>
 *
 * Uses action
 * 		C.ACTIONS.LEADER_REQUEST
 * 		C.ACTIONS.LEADER_VOTE
 *
 */
module.exports = class UniqueRegistry {
	constructor( options, clusterRegistry ) {
		this._options = options;
		this._clusterRegistry = clusterRegistry;
		this._locks = {};
		this._lockTimeouts = {};
		this._responseEventEmitter = new EventEmitter();
		this._onPrivateMessageFn = this._onPrivateMessage.bind( this );
		this._localTopic = this._getPrivateTopic( this._options.serverName );
		this._options.messageConnector.subscribe( this._localTopic, this._onPrivateMessageFn );
	}

	get( name, callback ) {
		var leaderServerName = this._clusterRegistry.getCurrentLeader();

		if( this._options.serverName === leaderServerName ) {
			callback( this._getLock( name ) );
		} else {
			//TODO start timeout
			this._getRemoteLock( name, leaderServerName, callback );
		}
	}

	release( name ) {
		var leaderServerName = this._clusterRegistry.getCurrentLeader();

		if( this._options.serverName === leaderServerName ) {
			this._releaseLock( name );
		} else {
			this._releaseRemoteLock( name, leaderServerName );
		}
	}

	_getRemoteLock( name, leaderServerName, callback ) {
		this._responseEventEmitter.once( name, callback );

		var remoteTopic = this._getPrivateTopic( leaderServerName );

		this._options.messageConnector.publish( remoteTopic, {
			topic: remoteTopic,
			action: C.ACTIONS.LOCK_REQUEST,
			data: [{
				name: name,
				responseTopic: this._localTopic
			}]
		});
	}

	_releaseRemoteLock( name, leaderServerName ) {
		var remoteTopic = this._getPrivateTopic( leaderServerName );

		this._options.messageConnector.publish( remoteTopic, {
			topic: remoteTopic,
			action: C.ACTIONS.LOCK_RELEASE,
			data: [{
				name: name
			}]
		});
	}

	_onPrivateMessage( message ) {
		if( !SUPPORTED_ACTIONS[ message.action ] ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );
			return;
		}

		if( !message.data || !message.data[ 0 ] ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data );
			return;
		}

		if( message.action === C.ACTIONS.LOCK_RESPONSE ) {
			this._handleRemoteLockResponse( message.data[ 0 ] );
			return;
		}

		//LOCK_REQUEST & LOCK_RELEASE require this node to be the leader
		if( this._isLeader() === false ) {
			// TODO log unsolicited message
			//TODO - What happens if the remote node believes we are the leader
			//but we don't agree?
			return;
		}

		if( message.action === C.ACTIONS.LOCK_REQUEST ) {
			this._handleRemoteLockRequest( message.data[ 0 ] );
		}
		else if( message.action === C.ACTIONS.LOCK_RELEASE ) {
			this._handleRemoteLockRelease( message.data[ 0 ] );
		}
	}

	_handleRemoteLockRequest( data ) {
		var result = this._getLock( data.name );
		this._options.messageConnector.publish( data.responseTopic, {
			topic: data.responseTopic,
			action: C.ACTIONS.LOCK_RESPONSE,
			data: [{
				name: data.name,
				result: result
			}]
		});
	}

	_handleRemoteLockResponse( data ) {
		this._responseEventEmitter.emit( data.name, data.result );
	}

	_handleRemoteLockRelease( data ) {
		delete this._locks[ data.name ];
	}

	_getPrivateTopic( serverName ) {
		return C.TOPIC.LEADER_PRIVATE + serverName;
	}

	_isLeader() {
		return this._options.serverName === this._clusterRegistry.getCurrentLeader();
	}

	_getLock( name, callback ) {
/*		this._lockTimeouts[ name ] = utils.setTimeout(
			this._onLockTimeout.bind( this, name ),
			this._options.lockTimeout
		);
*/
		if( this._locks[ name ] === true ) {
			return false;
		} else {
			this._locks[ name ] = true;
			return true;
		}
	}

	_releaseLock( name ) {
		clearTimeout( this._lockTimeouts[ name ] );
		delete this._locks[ name ];
	}

	_onLockTimeout( name ) {
		this._releaseLock( name );
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.TIMEOUT, 'lock ' + name + ' released due to timeout' );
	}

	_onLockRequestTimeout( name ) {
		this._handleRemoteLockResponse({ name: name, result: false });
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.TIMEOUT, 'request for lock ' + name + ' timed out' );
	}
}
