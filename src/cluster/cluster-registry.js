'use strict';

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
 * Add message
 *
 * {
 *   topic: C.TOPIC.CLUSTER
 *   action: C.ACTIONS.ADD
 *   data: [ serverName, publicIp, status ]
 * }
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
 * Status / KeepAlive Message
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
	}

	getAll() {

	}

	getLeastUtilizedExternalUrl() {

	}

	_onMessage( data ) {

	}

	_publishExists() {
		this._options.messageConnector.publish( C.TOPIC.CLUSTER, {
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.EXISTS,
			data:[
				this._options.serverName,
				this._options.publicIp,
				this._getState()
			]
		});
	}

	_getState() {
		var memoryStats = process.memoryUsage();

		return {
			browserConnections: this._connectionEndpoint.getBrowserConnectionCount(),
			tcpConnections: this._connectionEndpoint.getTcpConnectionCount(),
			memory: memoryStats.heapUsed / memoryStats.heapTotal
		}
	}
}