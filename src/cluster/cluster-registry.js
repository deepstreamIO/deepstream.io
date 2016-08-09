'use strict';

const EventEmitter = require( 'events' ).EventEmitter;
/**
 * Uses options
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
 *   data: [ serverName, publicIp ]
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
 * 		records: 634,
 * 		events: 345,
 * 		rpcs: 32
 * }
 */
module.exports = class ClusterRegistry extends EventEmitter{
	constructor( options ) {
		super();
	}

	getAll() {

	}

	getLeastUtilizedExternalUrl() {

	}
}