var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	ListenerRegistry = require( '../utils/listener-registry' ),
	RecordRequest = require( './record-request' ),
	RecordTransition = require( './record-transition' ),
	RecordDeletion = require( './record-deletion' ),
	messageParser = require( '../message/message-parser' ),
	messageBuilder = require( '../message/message-builder' );

/**
 * The entry point for record related operations
 *
 * @param {Object} options deepstream options
 */
var RecordHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RECORD );
	this._listenerRegistry = new ListenerRegistry( C.TOPIC.RECORD, options, this._subscriptionRegistry );
	this._subscriptionRegistry.setSubscriptionListener( this._listenerRegistry );
	this._hasReadTransforms = this._options.dataTransforms && this._options.dataTransforms.has( C.TOPIC.RECORD, C.ACTIONS.READ );
	this._hasUpdateTransforms = this._options.dataTransforms && this._options.dataTransforms.has( C.TOPIC.RECORD, C.ACTIONS.UPDATE );
	this._hasPatchTransforms = this._options.dataTransforms && this._options.dataTransforms.has( C.TOPIC.RECORD, C.ACTIONS.PATCH );
	this._transitions = [];
};

/**
 * Handles incoming record requests.
 *
 * Please note that neither CREATE nor READ is supported as a
 * client send action. Instead the client sends CREATEORREAD
 * and deepstream works which one it will be
 *
 * @param   {SocketWrapper} socketWrapper the sender
 * @param   {Object} message parsed and validated deepstream message
 *
 * @public
 * @returns {void}
 */
RecordHandler.prototype.handle = function( socketWrapper, message ) {

	/*
	 * All messages have to provide at least the name of the record they relate to
	 * or a pattern in case of listen
	 */
	if( !message.data || message.data.length < 1 ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	/*
	 * Return the record's contents and subscribes for future updates.
	 * Creates the record if it doesn't exist
	 */
	if( message.action === C.ACTIONS.CREATEORREAD ) {
		this._createOrRead( socketWrapper, message );
	}

	/*
	 * Return the current state of the record in cache or db
	 */
	else if( message.action === C.ACTIONS.SNAPSHOT ) {
		this._snapshot( socketWrapper, message );
	}

	/*
	 * Return a Boolean to indicate if record exists in cache or database
	 */
	else if( message.action === C.ACTIONS.HAS ) {
		this._hasRecord( socketWrapper, message );
	}

	/*
	 * Handle complete (UPDATE) or partial (PATCH) updates
	 */
	else if( message.action === C.ACTIONS.UPDATE || message.action === C.ACTIONS.PATCH ) {
		this._update( socketWrapper, message );
	}

	/*
	 * Deletes the record
	 */
	else if( message.action === C.ACTIONS.DELETE ) {
		this._delete( socketWrapper, message );
	}

	/*
	 * Unsubscribes (discards) a record that was previously subscribed to
	 * using read()
	 */
	else if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
		this._subscriptionRegistry.unsubscribe( message.data[ 0 ], socketWrapper );
	}

	/*
	 * Return a list of all the records that much the pattern
	 */
	else if( message.action === C.ACTIONS.LISTEN_SNAPSHOT ) {
		this._listenerRegistry.sendSnapshot( socketWrapper, message );
	}

	/*
	 * Listen to requests for a particular record or records
	 * whose names match a pattern
	 */
	else if( message.action === C.ACTIONS.LISTEN ) {
		this._listenerRegistry.addListener( socketWrapper, message );
	}

	/*
	 * Remove the socketWrapper as a listener for
	 * the specified pattern
	 */
	else if( message.action === C.ACTIONS.UNLISTEN ) {
		this._listenerRegistry.removeListener( socketWrapper, message );
	}

	/*
	 * Default for invalid messages
	 */
	else {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );

		if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
		}
	}
};

/**
 * Tries to retrieve the record from the cache or storage. If not found in either
 * returns false, otherwise returns true.
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._hasRecord = function( socketWrapper, message ) {
	var recordName = message.data[ 0 ],
		onComplete = function( record ) {
			var hasRecord = record ? C.TYPES.TRUE : C.TYPES.FALSE;
			socketWrapper.sendMessage( C.TOPIC.RECORD, C.ACTIONS.HAS, [ recordName, hasRecord ] );
		},
		onError = function( error ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.ACTIONS.HAS, [ recordName, error ] );
		};

	new RecordRequest( recordName, this._options, socketWrapper, onComplete.bind( this ), onError.bind( this ) );
};

/**
 * Sends the records data current data once loaded from the cache, and null otherwise
 *
 * @param {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 * @private
 * @returns {void}
 */
RecordHandler.prototype._snapshot = function( socketWrapper, message ) {
	var recordName = message.data[ 0 ],
		onComplete = function( record ) {
			if( record ) {
				this._sendRecord( recordName, record, socketWrapper );
			} else {
				socketWrapper.sendError( C.TOPIC.RECORD, C.ACTIONS.SNAPSHOT, [ recordName, C.EVENT.RECORD_NOT_FOUND ] );
			}
		},
		onError = function( error ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.ACTIONS.SNAPSHOT, [ recordName, error ] );
		};

	new RecordRequest( recordName, this._options, socketWrapper, onComplete.bind( this ), onError.bind( this ) );
};

/**
 * Tries to retrieve the record and creates it if it doesn't exist. Please
 * note that create also triggers a read once done
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._createOrRead = function( socketWrapper, message ) {
	var recordName = message.data[ 0 ],
		onComplete = function( record ) {
			if( record ) {
				this._read( recordName, record, socketWrapper );
			} else {
				this._permissionAction( C.ACTIONS.CREATE, recordName, socketWrapper, this._create.bind( this, recordName, socketWrapper ) );
			}
		};

	new RecordRequest( recordName, this._options, socketWrapper, onComplete.bind( this ) );
};

/**
 * Creates a new, empty record and triggers a read operation once done
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._create = function( recordName, socketWrapper ) {
	var record = {
		_v: 0,
		_d: {}
	};

	// store the records data in the cache and wait for the result
	this._options.cache.set( recordName, record, function( error ){
		if( error ) {
			this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.RECORD_CREATE_ERROR, recordName );
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.RECORD_CREATE_ERROR, recordName );
		}
		else {
			this._read( recordName, record, socketWrapper );
		}
	}.bind( this ));

	if( !this._options.storageExclusion || !this._options.storageExclusion.test( recordName ) ) {
		// store the record data in the persistant storage independently and don't wait for the result
		this._options.storage.set( recordName, record, function( error ) {
			if( error ) {
				this._options.logger.log( C.TOPIC.RECORD, C.EVENT.RECORD_CREATE_ERROR, 'storage:' + error );
			}
		}.bind( this ) );
	}
};

/**
 * Subscribes to updates for a record and sends its current data once done
 *
 * @param {String} recordName
 * @param {Object} record
 * @param {SocketWrapper} socketWrapper the socket that send the request
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._read = function( recordName, record, socketWrapper ) {
	this._permissionAction( C.ACTIONS.READ, recordName, socketWrapper, function() {
		this._subscriptionRegistry.subscribe( recordName, socketWrapper );
		this._sendRecord( recordName, record, socketWrapper );
	}.bind( this ));
};

/**
 * Sends the records data current data once done
 *
 * @param {String} recordName
 * @param {Object} record
 * @param {SocketWrapper} socketWrapper the socket that send the request
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._sendRecord = function( recordName, record, socketWrapper ) {
	var data = record._d;

	if( this._hasReadTransforms ) {
		data = this._options.dataTransforms.apply(
			C.TOPIC.RECORD,
			C.ACTIONS.READ,

			/*
			 * Clone the object to make sure that the transform method doesn't accidentally
			 * modify the object reference for other subscribers.
			 *
			 * JSON stringify/parse still seems to be the fastest way to achieve a deep copy.
			 * TODO Update once native Object.clone // Object.copy becomes a thing
			 */
			JSON.parse( JSON.stringify( data ) ),
			{ recordName: recordName, receiver: socketWrapper.user }
		);
	}

	socketWrapper.sendMessage( C.TOPIC.RECORD, C.ACTIONS.READ, [ recordName, record._v, data ] );
};

 /**
 * Applies both full and partial updates. Creates a new record transition that will live as long as updates
 * are in flight and new updates come in
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._update = function( socketWrapper, message ) {

	if( message.data.length < 3 ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.data[ 0 ] );
		return;
	}

	var recordName = message.data[ 0 ],
		version = parseInt( message.data[ 1 ], 10 );

	/*
	 * If the update message is received from the message bus, rather than from a client,
	 * assume that the original deepstream node has already updated the record in cache and
	 * storage and only broadcast the message to subscribers
	 */
	if( socketWrapper === C.SOURCE_MESSAGE_CONNECTOR ) {
		this._$broadcastUpdate( recordName, message, socketWrapper );
		return;
	}

	if( isNaN( version ) ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_VERSION, [ recordName, version ] );
		return;
	}

	if( this._transitions[ recordName ] && this._transitions[ recordName ].hasVersion( version ) ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.VERSION_EXISTS, [ recordName, version ] );
		return;
	}

	if( !this._transitions[ recordName ] ) {
		this._transitions[ recordName ] = new RecordTransition( recordName, this._options, this );
	}

	this._transitions[ recordName ].add( socketWrapper, version, message );
};

/**
 * Invoked by RecordTransition. Notifies local subscribers and other deepstream
 * instances of record updates
 *
 * @param   {String} name           record name
 * @param   {Object} message        parsed and validated deepstream message
 * @param   {SocketWrapper} originalSender the socket the update message was received from
 *
 * @package private
 * @returns {void}
 */
RecordHandler.prototype._$broadcastUpdate = function( name, message, originalSender ) {
	var transformUpdate = message.action === C.ACTIONS.UPDATE && this._hasUpdateTransforms,
		transformPatch = message.action === C.ACTIONS.PATCH && this._hasPatchTransforms;

	if( transformUpdate || transformPatch ) {
		this._broadcastTransformedUpdate( transformUpdate, transformPatch, name, message, originalSender );
	} else {
		this._subscriptionRegistry.sendToSubscribers( name, message.raw, originalSender );
	}

	if( originalSender !== C.SOURCE_MESSAGE_CONNECTOR ) {
		this._options.messageConnector.publish( C.TOPIC.RECORD, message );
	}
};

/**
 * Called by _$broadcastUpdate if registered transform functions are detected. Disassembles
 * the message and invokes the transform function prior to sending it to every individual receiver
 * so that receiver specific transforms can be applied.
 *
 * @param   {Boolean} transformUpdate is a update transform function registered that applies to this update?
 * @param   {Boolean} transformPatch  is a patch transform function registered that applies to this update?
 * @param   {String} name             the record name
 * @param   {Object} message          a parsed deepstream message object
 * @param   {SocketWrapper|String} originalSender  the original sender of the update or a string pointing at the messageBus
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._broadcastTransformedUpdate = function( transformUpdate, transformPatch, name, message, originalSender ) {
	var receiver = this._subscriptionRegistry.getSubscribers( name ) || [],
		metaData = {
			recordName: name,
			version: parseInt( message.data[ 1 ], 10 )
		},
		data,
		i;

	if( transformPatch ) {
		metaData.path = message.data[ 2 ];
	}

	for( i = 0; i < receiver.length; i++ ) {
		if( receiver[ i ] === originalSender ) {
			continue;
		}
		metaData.receiver = receiver[ i ].user;

		if( transformUpdate ) {
			// UPDATE
			// parse data every time to create a fresh copy
			data = JSON.parse( message.data[ 2 ] );
			data = this._options.dataTransforms.apply( message.topic, message.action, data, metaData );
			message.data[ 2 ] = JSON.stringify( data );
		} else {
			// PATCH
			// convert data every time to create a fresh copy
			data = messageParser.convertTyped( message.data[ 3 ] );
			data = this._options.dataTransforms.apply( message.topic, message.action, data, metaData );
			message.data[ 3 ] = messageBuilder.typed( data );
		}

		receiver[ i ].sendMessage( message.topic, message.action, message.data );
	}
};

/**
 * Called by a RecordTransition, either if it is complete or if an error occured. Removes
 * the transition from the registry
 *
 * @todo  refactor - this is a bit of a mess
 * @param   {String} recordName record name
 *
 * @package private
 * @returns {void}
 */
RecordHandler.prototype._$transitionComplete = function( recordName ) {
	delete this._transitions[ recordName ];
};

/**
 * Deletes a record. If a transition is in progress it will be stopped. Once the
 * deletion is complete, an Ack is returned.
 *
 * If the deletion message is received from the message bus, rather than from a client,
 * we assume that the original deepstream node has already deleted the record from cache and
 * storage and we only need to broadcast the message to subscribers
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._delete = function( socketWrapper, message ) {
	var recordName = message.data[ 0 ];

	if( this._transitions[ recordName ] ) {
		this._transitions[ recordName ].destroy();
		delete this._transitions[ recordName ];
	}

	if( socketWrapper === C.SOURCE_MESSAGE_CONNECTOR ) {
		this._$broadcastUpdate( recordName, message, socketWrapper );
		return;
	}

	new RecordDeletion( this._options, socketWrapper, message, this._$broadcastUpdate.bind( this ) );
};

/**
 * A secondary permissioning step that is performed once we know if the record exists (READ)
 * or if it should be created (CREATE)
 *
 * @param   {String} action          One of C.ACTIONS, either C.ACTIONS.READ or C.ACTIONS.CREATE
 * @param   {String} recordName      The name of the record
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Function} successCallback A callback that will only be invoked if the operation was successful
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._permissionAction = function( action, recordName, socketWrapper, successCallback ) {
	var message = {
		topic: C.TOPIC.RECORD,
		action: action,
		data: [ recordName ]
	};

	var onResult = function( error, canPerformAction ) {
		if( error !== null ) {
			socketWrapper.sendError( message.topic, C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString() );
		}
		else if( canPerformAction !== true ) {
			socketWrapper.sendError( message.topic, C.EVENT.MESSAGE_DENIED, action + ':' + recordName );
		}
		else {
			successCallback();
		}
	};

	this._options.permissionHandler.canPerformAction(
		socketWrapper.user,
		message,
		onResult,
		socketWrapper.userData
	);
};

module.exports = RecordHandler;