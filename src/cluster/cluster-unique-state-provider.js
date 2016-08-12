'use strict';

const C = require( '../constants/constants' );

/**
 * Uses options
 * 		uniqueTimeout
 *   	leaderResponseTimeout
 *
 * Uses topics
 * 		C.TOPIC.LEADER
 * 		C.TOPIC.LEADER_PRIVATE_<serverName>
 *
 * Uses action
 * 		C.ACTIONS.LEADER_REQUEST
 * 		C.ACTIONS.LEADER_VOTE
 *
 */
module.exports = class UniqueRegistry{
	constructor( options, clusterRegistry ) {
		this._options = options;
		this._clusterRegistry = clusterRegistry;
		
		this._leaderVotes = {};
		this._currentLeader = null;
		this._iAmTheLeader = false;
		this._privateTopic = C.TOPIC.LEADER_PRIVATE_ + options.serverName;
		this._onLeaderMessageFn = this._onLeaderMessage.bind( this );
		this._onPrivateMessageFn = this._onPrivateMessage.bind( this );
		this._onNodeRemoveFunction = this._onNodeRemoved.bind( this );
		this._clusterRegistry.on( 'remove', this._onNodeRemoveFunction );
		this._options.messageConnector.subscribe( C.TOPIC.LEADER, this._onLeaderMessageFn );
		this._options.messageConnector.subscribe( this._privateTopic, this._onPrivateMessageFn );
		this._initiateLeaderVote();
	}

	get( name, callback ) {
		// callback will be invoked with <bool> success
	}

	release( name ) {
		// will also happen on unique timeout
	}

	destroy() {
		this._options.messageConnector.unsubscribe( C.TOPIC.LEADER, this._onLeaderMessageFn );
		this._options.messageConnector.unsubscribe( this._privateTopic, this._onPrivateMessageFn );
	}

	_onLeaderMessage( message ) {
		if( message.action === C.ACTIONS.LEADER_REQUEST ) {
			this._leaderVotes = {};
			this._sendLeaderVote();
		}
		else if ( message.action === C.ACTIONS.LEADER_VOTE ) {
			this._processLeaderVote( message );
		}
	}

	_onPrivateMessage( message ) {

	}

	_initiateLeaderVote() {
		this._leaderVotes = {};
		this._options.messageConnector.publish( C.TOPIC.LEADER, {
			topic: C.TOPIC.LEADER,
			action: C.ACTIONS.LEADER_REQUEST,
			data: []
		});
		this._sendLeaderVote();
	}

	_processLeaderVote( message ) {
		if( !message.data || message.data.length !== 2 ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data );
			return;
		}

		this._leaderVotes[ message.data[ 0 ] ] = message.data[ 1 ];
		var serverNames = this._clusterRegistry.getAll();

		for( var i = 0; i < serverNames.length; i++ ) {
			if( !this._leaderVotes[ serverNames[ i ] ] ) {
				return;
			}
		}

		this._electNewLeader();
	}

	_sendLeaderVote() {
		this._leaderVotes[ this._options.serverName ] = Math.random();
		this._options.messageConnector.publish( C.TOPIC.LEADER, {
			topic: C.TOPIC.LEADER,
			action: C.ACTIONS.LEADER_VOTE,
			data: [ this._options.serverName, this._leaderVotes[ this._options.serverName ] ]
		});
	}

	_electNewLeader() {
		var serverName,
			currentHighScore = 0,
			currentHighScoreName;

		for( serverName in this._leaderVotes ) {
			if( this._leaderVotes[ serverName ] > currentHighScore ) {
				currentHighScore = this._leaderVotes[ serverName ];
				currentHighScoreName = serverName;
			}
		}

		this._currentLeader = serverName;
		this._iAmTheLeader = this._currentLeader === this._options.serverName;
	}

	_onNodeRemoved() {
		
	}
}
