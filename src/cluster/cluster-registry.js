'use strict';

const C = require( '../constants/constants' );
const EventEmitter = require( 'events' ).EventEmitter;
/**
 * 	Uses options
 * 	clusterKeepAliveInterval
 *
 * Uses topic C.TOPIC.CLUSTER
 *
 * Emits "add" <serverName>
 * Emits "remove" <serverName>
 *

 * Remove Message
 *
 * {
 *   topic: C.TOPIC.CLUSTER
 *   action: C.ACTIONS.REMOVE
 *   data: [ serverName ]
 * }
 *
 * Status Request Message
 * can be used if checksum got out of sync or if new node joined
 *
 * {
 *   topic: C.TOPIC.CLUSTER
 *   action: C.ACTIONS.STATUS_REQUEST,
 *   data: []
 * }
 *
 * Status / KeepAlive / Add message
 *
 * {
 *   topic: C.TOPIC.CLUSTER
 *   action: C.ACTIONS.STATUS
 *   data: [ serverName, clusterChecksum, statusData ]
 * }
 *
 * statusData can be e.g.
 *
 * {
 * 		browserConnections: 3434,
 * 		tcpConnections: 32,
 * 		memory: 0.6,
 * 		checkSum: checkSum
 * }
 *
 * // Client
 * ds.cluster.subscribe();??
 * ds.cluster.unsubscribe();??
 */
module.exports = class ClusterRegistry extends EventEmitter{
	constructor( options, connectionEndpoint ) {
		super();
		this._options = options;
		this._connectionEndpoint = connectionEndpoint;
		this._options.messageConnector.subscribe( C.TOPIC.CLUSTER, this._onMessage.bind( this ) );
		this._publishExists();
		setInterval( this._publishExists.bind( this ), this._options.clusterKeepAliveInterval );
		process.on( 'beforeExit', this.leaveCluster.bind( this ) );
		process.on( 'exit', this.leaveCluster.bind( this ) );
	}

	leaveCluster() {
		this._options.messageConnector.publish( C.TOPIC.CLUSTER, {
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.REMOVE,
			data:[
				this._options.serverName,
			]
		});
		this._options.messageConnector.unsubscribe( C.TOPIC.CLUSTER );
	}

	getAll() {

	}

	getLeastUtilizedExternalUrl() {

	}

	_onMessage( data ) {
		if( message.action === C.ACTIONS.STATUS_REQUEST ) {
			this._publishExists();
			return;
		}

		if( message.data.length !== 0 ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data );
			return;
		}

		if( message.action === C.ACTIONS.STATUS ) {
			this._addNode( message.data[ 0 ] );
		}
		else if( message.action === C.ACTIONS.REMOVE ) {
			this._removeNode( message.data[ 0 ] );
		}
		else {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );
		}
	}

	_addNode( data ) {
		if( !this._nodes[ data.serverName ] ) {
			this._nodes[ data.serverName ] = data;
			this.emit( 'add', data.serverName );
		}
	}

	_removeNode( data ) {
		if( this._nodes[ data.serverName ] ) {
			delete this._nodes[ data.serverName ];
			this.emit( 'remove', data.serverName );
		}
	}

	_publishExists() {
		var memoryStats = process.memoryUsage();

		this._options.messageConnector.publish( C.TOPIC.CLUSTER, {
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.EXISTS,
			data:[{
				serverName: this._options.serverName,
				browserConnections: this._connectionEndpoint.getBrowserConnectionCount(),
				tcpConnections: this._connectionEndpoint.getTcpConnectionCount(),
				memory: memoryStats.heapUsed / memoryStats.heapTotal,
				externalUrl: this._options.externalUrl//,
	//			clusterChecksum: this._clusterChecksum TOTO
			}]
		});
	}
}