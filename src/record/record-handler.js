var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	RecordRequest = require( './record-request' ),
	RecordTransition = require( './record-transition' ),
	RecordDeletion = require( './record-deletion' );

/**
 * The entry point for record related operations
 *
 * @param {Object} options deepstream options
 */
var RecordHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RECORD );
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
	 * Listen to requests for a particular record or records
	 * whose names match a pattern
	 */
	else if( message.action === C.ACTIONS.LISTEN ) {
		this._listen( socketWrapper, message );
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
				this._create( recordName, socketWrapper );
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
	
	this._options.cache.set( recordName, record, function( error ){
		if( error ) {
			this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.RECORD_CREATE_ERROR, recordName );
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.RECORD_CREATE_ERROR, recordName );
		} 
		else {
			this._read( recordName, record, socketWrapper );
		}
	}.bind( this ));
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
	this._subscriptionRegistry.subscribe( recordName, socketWrapper );
	socketWrapper.sendMessage( C.TOPIC.RECORD, C.ACTIONS.READ, [ recordName, record._v, record._d ] );
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
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_VERSION, version );
		return;
	}

	if( this._transitions[ recordName ] && this._transitions[ recordName ].hasVersion( version ) ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.VERSION_EXISTS, version );
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
	this._subscriptionRegistry.sendToSubscribers( name, message.raw, originalSender );

	if( originalSender !== C.SOURCE_MESSAGE_CONNECTOR ) {
		this._options.messageConnector.publish( C.TOPIC.RECORD, message );
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
 * Register a client as a listener for record subscriptions
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._listen = function( socketWrapper, message ) {
	//TODO
};

module.exports = RecordHandler;