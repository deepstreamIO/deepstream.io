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
		this._nodes = {};
		this._onMessageFn = this._onMessage.bind( this );
		this._options.messageConnector.subscribe( C.TOPIC.CLUSTER, this._onMessageFn );
		this._publishStatus();
		setInterval( this._publishStatus.bind( this ), this._options.clusterKeepAliveInterval );
		setInterval( this._checkNodes.bind( this ), this._options.clusterActiveCheckInterval );
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
		this._options.messageConnector.unsubscribe( C.TOPIC.CLUSTER, this._onMessageFn );
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
		if( message.action === C.ACTIONS.STATUS_REQUEST ) {
			this._publishStatus();
			return;
		}

		var data = message.data[ 0 ];

		if( !data ) {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data );
			return;
		}

		if( message.action === C.ACTIONS.STATUS ) {
			var isNew = !this._nodes[ data.serverName ];

			this._updateNode( data );

			if( isNew ) {
				this.emit( 'add', data.serverName );
			}	
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
console.log( 'CHECK', this._nodes[ serverName ].lastStatusTime - now, this._options.clusterNodeInactiveTimeout );
		for( serverName in this._nodes ) {
			if( this._nodes[ serverName ].lastStatusTime - now > this._options.clusterNodeInactiveTimeout ) {
				this._removeNode( this._nodes[ serverName ] );
			}
		}
	}

	_updateNode( data ) {
		this._nodes[ data.serverName ] = data;
		this._nodes[ data.serverName ].lastStatusTime = Date.now();
	}

	_removeNode( serverName ) {
		if( this._nodes[ serverName ] ) {
			delete this._nodes[ serverName ];
			this.emit( 'remove', serverName );
		}
	}

	_publishStatus() {
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