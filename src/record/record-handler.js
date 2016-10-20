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
		this._sendError( C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ], socketWrapper );
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
		message.action === C.ACTIONS.LISTEN_REJECT ) {
		this._listenerRegistry.handle( socketWrapper, message );
		return;
	}

	const recordName = message.data[ 0 ];

	this._logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, [ recordName, message.action ] );

	this._sendError( C.EVENT.UNKNOWN_ACTION, [ recordName, 'unknown action ' + message.action ], socketWrapper );
};

RecordHandler.prototype._read = function( socketWrapper, message ) {
	const recordName = message.data[ 0 ];
	Promise
		.all( [
			this.getRecord( recordName ),
			this._permissionAction( C.ACTIONS.READ, recordName, socketWrapper )
		] )
		.then( ( [ record ] ) => {
			this._subscriptionRegistry.subscribe( recordName, socketWrapper );
			this._sendRecord( recordName, record, socketWrapper );
		} )
		.catch( error => this._sendError( error.event, [ recordName, error.message ], socketWrapper ) );
};

RecordHandler.prototype._update = function( socketWrapper, message ) {
	const recordName = message.data[ 0 ];

	if( message.data.length < 4 ) {
		this._sendError( C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.data[ 0 ] ], socketWrapper );
		return;
	}

	const version = message.data[ 1 ];
	const parent = message.data[ 3 ];

	if( !version || !version.match(/\d+-.+/) ) {
		this._sendError( C.EVENT.INVALID_VERSION, [ recordName, version ], socketWrapper );
		return;
	}

	if( parent && !parent.match(/\d+-.+/) ) {
		this._sendError( C.EVENT.INVALID_VERSION, [ recordName, version ], socketWrapper );
		return;
	}

	const json = utils.JSONParse( message.data[ 2 ] );

	if ( json.error ) {
		this._sendError( C.EVENT.INVALID_MESSAGE_DATA, [ recordName, message.raw ], socketWrapper );
		return;
	}

	const record = { _v: version, _d: json.value, _p: parent };

	if ( socketWrapper !== C.SOURCE_STORAGE_CONNECTOR && socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
		this._storage.set( recordName, record );
	}

	this._broadcastUpdate( recordName, record, message, socketWrapper );
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

RecordHandler.prototype._broadcastUpdate = function( recordName, nextRecord, message, socketWrapper ) {
	if (nextRecord._v) {
		this._cache.set( recordName + nextRecord._v, nextRecord );
	}

	const prevRecord = this._cache.get( recordName );

	if ( prevRecord && utils.compareVersions( prevRecord._v, nextRecord._v ) ) {
		return;
	}

	this._cache.set( recordName, nextRecord );

	if( this._hasUpdateTransforms ) {
		this._broadcastTransformedUpdate( recordName, nextRecord, message, socketWrapper );
	} else {
		this._subscriptionRegistry.sendToSubscribers( recordName, message.raw, socketWrapper );
	}

	if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR && socketWrapper !== C.SOURCE_STORAGE_CONNECTOR ) {
		this._messageConnector.publish( C.TOPIC.RECORD, message );
	}
};

RecordHandler.prototype._broadcastTransformedUpdate = function( recordName, record, message, socketWrapper ) {
	const subscribers = this._subscriptionRegistry.getLocalSubscribers( recordName ) || [];
	const version = message.data[ 1 ]

	for( let i = 0; i < subscribers.length; i++ ) {
		if( subscribers[ i ] !== socketWrapper ) {
			const data = this._dataTransforms.apply( message.topic, message.action, record, {
				recordName,
				version,
				receiver: subscribers[ i ].user
			} );
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
			if( error ) {
				reject( {
					event: C.EVENT.MESSAGE_PERMISSION_ERROR,
					message: error.toString()
				} );
			}
			else if( !canPerformAction ) {
				reject( {
					event: C.EVENT.MESSAGE_DENIED,
					message: action
				} );
			}
			else {
				resolve();
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

RecordHandler.prototype.getRecord = function( recordName, version ) {
	const key = recordName + (version || '')
	return this._cache.has( key )
		? Promise.resolve( this._cache.get( key ) )
		: this._getRecordFromStorage( key, version )
				.then( record => {
					if ( !this._cache.has( key ) ) {
						this._cache.set( key, record );
					}
					return record;
				} );
};

RecordHandler.prototype._sendError = function( event, message, socketWrapper ) {
	if ( socketWrapper && socketWrapper.sendError ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message );
	} else {
		this._logger.log( C.LOG_LEVEL.ERROR, error.event, message );
	}
};

RecordHandler.prototype._getRecordFromStorage = function( recordName, version ) {
	return new Promise( ( resolve, reject ) => this._storage.get( recordName, version, ( error, record ) => {
		if ( error || !record) {
			const error = new Error('error while loading ' + recordName + ' from storage:' + (error || 'not_found'));
			error.event = C.EVENT.RECORD_LOAD_ERROR;
			reject( error );
		} else {
			resolve( record );
		}
	} ) );
};

RecordHandler.prototype._onStorageChange = function( recordName, version ) {
	const prevRecord = this._cache.get( recordName );

	if ( prevRecord && utils.compareVersions( prevRecord._v, version ) ) {
		return;
	}

	this._getRecordFromStorage( recordName )
		.then( record => {
			const prevRecord = this._cache.get( recordName );

			if ( prevRecord && utils.compareVersions( prevRecord._v, record._v ) ) {
				return;
			}

			const message = {
				topic: C.TOPIC.RECORD,
				action: C.ACTIONS.UPDATE,
				data: [ recordName, record._v, JSON.stringify( record._d ), record._p ]
			};
			message.raw = messageBuilder.getMsg( message.topic, message.action, message.data );
			this._broadcastUpdate( recordName, record, message, C.SOURCE_STORAGE_CONNECTOR );
		} )
		.catch( error => this._logger.log( C.LOG_LEVEL.ERROR, error.event, [ recordName, error.message ] ) );
};

module.exports = RecordHandler;
