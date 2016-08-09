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
		this._options.messageConnector.subscribe( C.TOPIC.CLUSTER, this._onMessage.bind( this ) );
		this._publishExists();
		setInterval( this._publishExists.bind( this ), this._options.clusterKeepAliveInterval );
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
		this._options.messageConnector.unsubscribe( C.TOPIC.CLUSTER );
	}

	getAll() {
		return Object.keys( this._nodes );
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
			if( !this._nodes[ data.serverName ] ) {
				this._addNode( message.data[ 0 ] );
			} else {
				this._updateNode( message.data[ 0 ] );
			}
		} 
		else if( message.action === C.ACTIONS.REMOVE ) {
			this._removeNode( message.data[ 0 ] );
		}
		else {
			this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );
		}
	}

	_checkNodes() {
		var now = Date.now(),
			serverName;

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

	_addNode( data ) {
		this._nodes[ data.serverName ] = data;
		this.emit( 'add', data.serverName );
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
				externalUrl: this._options.externalUrl
			}]
		});
	}
}