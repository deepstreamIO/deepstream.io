var C = require( '../constants/constants' ),
	SubscriptionRegistry = require( '../utils/subscription-registry' ),
	messageParser = require( '../message/message-parser' ),
	RecordRequest = require( './record-request' ),
	RecordTransition = require( './record-transition' );

var RecordHandler = function( options ) {
	this._options = options;
	this._subscriptionRegistry = new SubscriptionRegistry( options, C.TOPIC.RECORD );
	this._transitions = [];
};

/**
 * Handles incoming record requests.
 *
 * Please not that neither CREATE nor READ is allowed as a
 * client send action. Instead the client sends CREATEORREAD
 * and deepstream works out the rest
 *
 * @param   {[type]} socketWrapper [description]
 * @param   {[type]} message       [description]
 *
 * @returns {[type]}               [description]
 */
RecordHandler.prototype.handle = function( socketWrapper, message ) {

	if( !message.data || message.data.length < 1 ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw );
		return;
	}

	if( message.action === C.ACTIONS.CREATEORREAD ) {
		this._createOrRead( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UPDATE || message.action === C.ACTIONS.PATCH ) {
		this._update( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.DELETE ) {
		this._delete( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.UNSUBSCRIBE ) {
		this._unsubscribe( socketWrapper, message );
	}

	else if( message.action === C.ACTIONS.LISTEN ) {
		this._listen( socketWrapper, message );
	}

	else {
		this._options.logger.log( C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action );
		
		if( socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR ) {
			socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, 'unknown action ' + message.action );
		}
	}
};

/**
 * [_createOrRead description]
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
 * [_createOrRead description]
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
 * [_createOrRead description]
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

RecordHandler.prototype._update = function( socketWrapper, message ) {
	if( message.data.length < 3 ) {
		socketWrapper.sendError( C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.data[ 0 ] );
		return;
	}

	var recordName = message.data[ 0 ],
		version = parseInt( message.data[ 1 ], 10 );

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

RecordHandler.prototype._$broadcastUpdate = function( name, message, originalSender ) {
	this._subscriptionRegistry.sendToSubscribers( name, message.raw, originalSender );
};

RecordHandler.prototype._$transitionComplete = function( recordName ) {
	delete this._transitions[ recordName ];
};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._delete = function( socketWrapper, message ) {

};


/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._unsubscribe = function( socketWrapper, message ) {

};

/**
 * [_createOrRead description]
 *
 * @param   {SocketWrapper} socketWrapper the socket that send the request
 * @param   {Object} message parsed and validated message
 *
 * @private
 * @returns {void}
 */
RecordHandler.prototype._listen = function( socketWrapper, message ) {

};

module.exports = RecordHandler;