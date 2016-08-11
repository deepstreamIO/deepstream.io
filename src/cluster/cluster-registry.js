'use strict';

const C = require( '../constants/constants' );
const EventEmitter = require( 'events' ).EventEmitter;
/**
 * 	Uses options
 * 	clusterKeepAliveInterval
 * 	clusterActiveCheckInterval
 * 	clusterNodeInactiveTimeout
 */
module.exports = class ClusterRegistry extends EventEmitter{
	constructor( options, connectionEndpoint ) {
		super();
		this._options = options;
		this._connectionEndpoint = connectionEndpoint;
		this._inCluster = false;
		this._nodes = {};
		this._onMessageFn = this._onMessage.bind( this );
		this._leaveClusterFn = this.leaveCluster.bind( this );
		this._options.messageConnector.subscribe( C.TOPIC.CLUSTER, this._onMessageFn );
		this._publishStatus();
		this._publishInterval = setInterval( this._publishStatus.bind( this ), this._options.clusterKeepAliveInterval );
		this._checkInterval = setInterval( this._checkNodes.bind( this ), this._options.clusterActiveCheckInterval );
		process.on( 'beforeExit', this._leaveClusterFn );
		process.on( 'exit', this._leaveClusterFn );
	}

	leaveCluster() {
		if( this._inCluster === false ) {
			return;
		}
		this._options.messageConnector.publish( C.TOPIC.CLUSTER, {
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.REMOVE,
			data:[ this._options.serverName ]
		});
		this._options.messageConnector.unsubscribe( C.TOPIC.CLUSTER, this._onMessageFn );
		process.removeListener( 'beforeExit', this._leaveClusterFn );
		process.removeListener( 'exit', this._leaveClusterFn );
		clearInterval( this._publishInterval );
		clearInterval( this._checkInterval );
		this._inCluster = false;
	}

	getAll() {
		return Object.keys( this._nodes );
	}

	getLeastUtilizedExternalUrl() {
		var minMemory = Infinity, serverName, minNode;

		for( serverName in this._nodes ) {
			if( this._nodes[ serverName ].memory < minMemory ) {
				minMemory = this._nodes[ serverName ].memory;
				minNode = this._nodes[ serverName ];
			}
		}

		return minNode.externalUrl;
	}

	_onMessage( message ) {
		var data = message.data[ 0 ];

		if( !data ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data );
		}
		else if( message.action === C.ACTIONS.STATUS ) {
			this._updateNode( data );
		}
		else if( message.action === C.ACTIONS.REMOVE ) {
			this._removeNode( data );
		}
		else {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );
		}
	}

	_checkNodes() {
		var now = Date.now(),
			serverName;

		for( serverName in this._nodes ) {
			if( now - this._nodes[ serverName ].lastStatusTime > this._options.clusterNodeInactiveTimeout ) {
				this._removeNode( serverName );
			}
		}
	}

	_updateNode( data ) {
		var isNew = !this._nodes[ data.serverName ];
		this._nodes[ data.serverName ] = data;
		this._nodes[ data.serverName ].lastStatusTime = Date.now();
		if( isNew ) {
			this.emit( 'add', data.serverName );
		}
	}

	_removeNode( serverName ) {
		if( this._nodes[ serverName ] ) {
			delete this._nodes[ serverName ];
			this.emit( 'remove', serverName );
		}
	}

	_publishStatus() {
		this._inCluster = true;
		var memoryStats = process.memoryUsage();

		var data = {
			serverName: this._options.serverName,
			browserConnections: this._connectionEndpoint.getBrowserConnectionCount(),
			tcpConnections: this._connectionEndpoint.getTcpConnectionCount(),
			memory: memoryStats.heapUsed / memoryStats.heapTotal,
			externalUrl: this._options.externalUrl
		};

		this._updateNode( data );

		this._options.messageConnector.publish( C.TOPIC.CLUSTER, {
			topic: C.TOPIC.CLUSTER,
			action: C.ACTIONS.STATUS,
			data:[ data ]
		});
	}
}