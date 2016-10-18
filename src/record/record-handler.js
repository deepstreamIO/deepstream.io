const C = require( '../constants/constants' );
const SubscriptionRegistry = require( '../utils/subscription-registry' );
const ListenerRegistry = require( '../listen/listener-registry' );
const messageParser = require( '../message/message-parser' );
const messageBuilder = require( '../message/message-builder' );
const utils = require( '../utils/utils' );
const EventEmitter = require( 'events' ).EventEmitter;
const LRU = require('lru-cache');

const RecordHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RECORD );
	this._listenerRegistry = new ListenerRegistry( C.TOPIC.RECORD, options, this._subscriptionRegistry );
	this._subscriptionRegistry.setSubscriptionListener( this._listenerRegistry );
	this._dataTransforms = this._options.dataTransforms;
	this._hasReadTransforms = this._dataTransforms && this._dataTransforms.has( C.TOPIC.RECORD, C.ACTIONS.READ );
	this._hasUpdateTransforms = this._dataTransforms && this._dataTransforms.has( C.TOPIC.RECORD, C.ACTIONS.UPDATE );
	this._transitions = {};
	this._permissionHandler = this._options.permissionHandler;
	this._logger = this._options.logger;
	this._recordRequestsInProgress = {};
	this._messageConnector = this._options.messageConnector;
	this._storage = this._options.storage;
	this._storage.on('change', this._onStorageChange.bind( this ) );
	this._cache = new LRU({ max: this._options.cacheSize || 1e5 });
};

RecordHandler.prototype.handle = function( socketWrapper, message ) {
	if( !message.data || message.data.length < 1 ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	if( message.action === C.ACTIONS.READ ) {
		this._read( socketWrapper, message );
		return;
	}

	if( message.action === C.ACTIONS.UPDATE ) {
		this._update( socketWrapper, message );
		return;
	}

	if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
		this._unsubscribe( socketWrapper, message );
		return;
	}

	if( message.action === C.ACTIONS.LISTEN ||
		message.action === C.ACTIONS.UNLISTEN ||
		message.action === C.ACTIONS.LISTEN_ACCEPT ||
		message.action === C.ACTIONS.LISTEN_REJECT ||
		message.action === C.ACTIONS.LISTEN_SNAPSHOT ) {
		this._listenerRegistry.handle( socketWrapper, message );
		return;
	}

	this._logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );

	if( socketWrapper.sendError ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
	}
};

RecordHandler.prototype._read = function( socketWrapper, message ) {
	const recordName = message.data[ 0 ];
	this.getRecord( recordName )
		.then( record => 	this._permissionAction( C.ACTIONS.READ, recordName, socketWrapper )
			.then( hasPermission => {
				if ( !hasPermission  ) {
					return;
				}
				this._subscriptionRegistry.subscribe( recordName, socketWrapper );
				this._sendRecord( recordName, record || { _v: 0, _d: {} }, socketWrapper );
			}) )
		.catch( error => socketWrapper.sendError( C.TOPIC.RECORD, error.event, [ recordName, error.message ] ) );
};

RecordHandler.prototype._update = function( socketWrapper, message ) {
	const recordName = message.data[ 0 ];

	if( message.data.length < 3 ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.data[ 0 ] );
		return;
	}

	const version = parseInt( message.data[ 1 ], 10 );

	if( isNaN( version ) ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_VERSION, [ recordName, version ] );
		return;
	}

	const json = utils.JSONParse( message.data[ 2 ] );

	if ( json.error ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	const prevRecord = this._cache.get( recordName );
	const nextRecord = { _v: version, _d: json.value };

	// Always write to storage (even if wrong version) in order to resolve conflicts
	if ( socketWrapper !== C.SOURCE_STORAGE_CONNECTOR && socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
		this._storage.set( recordName, nextRecord, error => {
			if( error ) {
				this._logger.log( C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, error );
			}
		} );
	}

	if ( prevRecord && prevRecord._v >= nextRecord._v ) {
		return;
	}

	this._cache.set( recordName, nextRecord );

	if( this._hasUpdateTransforms ) {
		this._broadcastTransformedUpdate( recordName, record, message, socketWrapper );
	} else {
		this._subscriptionRegistry.sendToSubscribers( recordName, message.raw, socketWrapper );
	}

	if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR && socketWrapper !== C.SOURCE_STORAGE_CONNECTOR ) {
		this._messageConnector.publish( C.TOPIC.RECORD, message );
	}
};

RecordHandler.prototype._unsubscribe = function( socketWrapper, message ) {
	const recordName = message.data[ 0 ];
	this._subscriptionRegistry.unsubscribe( recordName, socketWrapper );
}

RecordHandler.prototype._sendRecord = function( recordName, record, socketWrapper ) {
	let data = record._d;

	if( this._hasReadTransforms ) {
		data = this._dataTransforms.apply(
			C.TOPIC.RECORD,
			C.ACTIONS.READ,
			data,
			{ recordName: recordName, receiver: socketWrapper.user }
		);
	}

	socketWrapper.sendMessage( C.TOPIC.RECORD, C.ACTIONS.READ, [ recordName, record._v, data ] );
};

RecordHandler.prototype._broadcastTransformedUpdate = function( recordName, record, message, originalSender ) {
	const subscribers = this._subscriptionRegistry.getLocalSubscribers( recordName ) || [];

	for( let i = 0; i < subscribers.length; i++ ) {
		if( subscribers[ i ] !== originalSender ) {
			const metaData = {
				recordName: recordName,
				version: parseInt( message.data[ 1 ], 10 ),
				receiver: subscribers[ i ].user
			};

			const data = this._dataTransforms.apply( message.topic, message.action, record, metaData );
			subscribers[ i ].sendMessage(
				message.topic,
				message.action,
				[ ...message.slice(0, 2), JSON.stringify( data ) ]
			);
		}
	}
};

RecordHandler.prototype.removeRecordRequest = function( recordName ) {
	if( !this._recordRequestsInProgress[ recordName ] ) {
		return;
	}

	if( this._recordRequestsInProgress[ recordName ].length === 0 ) {
		delete this._recordRequestsInProgress[ recordName ];
		return;
	}

	this._recordRequestsInProgress[ recordName ].splice( 0, 1 )[ 0 ]();
};

RecordHandler.prototype.runWhenRecordStable = function( recordName, callback ) {
	if( !this._recordRequestsInProgress[ recordName ] ) {
		this._recordRequestsInProgress[ recordName ] = [];
		callback();
	} else {
		this._recordRequestsInProgress[ recordName ].push( callback );
	}
};

RecordHandler.prototype._permissionAction = function( action, recordName, socketWrapper ) {
	return new Promise( ( resolve, reject ) => {
		const message = {
			topic: C.TOPIC.RECORD,
			action: action,
			data: [ recordName ]
		};

		const callback = ( error, canPerformAction ) => {
			if( error !== null ) {
				socketWrapper.sendError( message.topic, C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString() );
				resolve( false );
			}
			else if( !canPerformAction ) {
				socketWrapper.sendError( message.topic, C.EVENT.MESSAGE_DENIED, [ recordName, action ] );
				resolve( false );
			}
			else {
				resolve( true );
			}
		};

		this._permissionHandler.canPerformAction(
			socketWrapper.user,
			message,
			callback,
			socketWrapper.authData
		);
	})

};

RecordHandler.prototype.getRecord = function ( recordName ) {
	return this._cache.has( recordName )
		? Promise.resolve( this._cache.get( recordName ) )
		: this._getRecordFromStorage( recordName );
}

RecordHandler.prototype._getRecordFromStorage = function ( recordName ) {
	return new Promise( ( resolve, reject ) => this._storage.get( recordName, ( error, record ) => {
		if ( error ) {
			const message = 'error while loading ' + recordName + ' from storage:' + error.toString();
			const event = C.EVENT.RECORD_LOAD_ERROR;
			reject( {
				message,
				event,
				toString: () => message
			} );
		} else {
			if ( !this._cache.has( recordName ) ) {
				this._cache.set( recordName, record );
			}
			resolve( record );
		}
	} ) );
}

RecordHandler.prototype._onStorageChange = function( recordName, version ) {
	const prevRecord = this._cache.get( recordName );

	if ( prevRecord && prevRecord._v >= version ) {
		return;
	}

	this._getRecordFromStorage( recordName )
		.then( nextRecord => this._update( C.SOURCE_STORAGE_CONNECTOR, { data: [ recordName, version, JSON.stringify( nextRecord ) ] } ) )
		.catch( error => this._logger.log( C.LOG_LEVEL.ERROR, error.event, [ recordName, error.message ] ) );
}

module.exports = RecordHandler;
