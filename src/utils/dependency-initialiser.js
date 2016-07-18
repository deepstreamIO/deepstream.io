var C = require( '../constants/constants' ),
	EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' );

/**
 * This class is used to track the initialisation of
 * an individual dependency (cache connector, persistance connector,
 * message connector, logger)
 *
 * @param {Object} options deepstream options
 * @param {String} name    the key of the dependency within the options
 *
 * @constructor
 */
var DependencyInitialiser = function( options, name ) {
	this.isReady = false;

	this._options = options;
	this._dependency = options[ name ];
	this._name = name;
	this._timeout = null;

	if( typeof this._dependency.on !== 'function' && typeof this._dependency.isReady === 'undefined' ) {
		const errorMessage = `${this._name} needs to implement isReady or be an emitter`;
		this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.PLUGIN_INITIALIZATION_ERROR, errorMessage );
		const error = new Error( errorMessage );
		error.code = 'PLUGIN_INITIALIZATION_ERROR';
		throw error;
	}

	if( this._dependency.isReady ) {
		this._onReady();
	} else {
		this._timeout = setTimeout( this._onTimeout.bind( this ), this._options.dependencyInitialisationTimeout );
		this._dependency.once( 'ready', this._onReady.bind( this ) );
		this._dependency.on( 'error', this._onError.bind( this ) );

		if( this._dependency.init ) {
			this._dependency.init();
		}
	}
};

utils.inherits( DependencyInitialiser, EventEmitter );

/**
 * Returns the underlying dependency (e.g. the Logger, StorageConnector etc.)
 *
 * @public
 * @returns {Dependency}
 */
DependencyInitialiser.prototype.getDependency = function() {
	return this._dependency;
};

/**
 * Callback for succesfully initialised dependencies
 *
 * @private
 * @returns {void}
 */
DependencyInitialiser.prototype._onReady = function() {
	if( this._timeout ) {
		clearTimeout( this._timeout );
	}

	var dependencyType = this._dependency.type ? ': ' + this._dependency.type : ''
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, `${this._name} ready${dependencyType}`  );
	process.nextTick( this._emitReady.bind( this ) );
};

/**
 * Callback for dependencies that weren't initialised in time
 *
 * @private
 * @returns {void}
 */
DependencyInitialiser.prototype._onTimeout = function() {
	const message = this._name + ' wasn\'t initialised in time';
	this._logError( message );
	const error = new Error( message );
	error.code = C.EVENT.PLUGIN_INITIALIZATION_TIMEOUT;
	throw error;

};

/**
* Handles errors emitted by the dependency at startup.
*
* Plugin errors that occur at runtime are handled by the deepstream.io main class
*
* @param {Error|String} error
*
* @private
* @returns {void}
*/
DependencyInitialiser.prototype._onError = function( error ) {
	if( this.isReady !== true ) {
		this._logError( 'Error while initialising ' + this._name + ': ' + error.toString() );
		error.code = C.EVENT.PLUGIN_INITIALIZATION_ERROR;
		throw error;
	}
};

/**
 * Emits the ready event after a one tick delay
 *
 * @private
 * @returns {void}
 */
DependencyInitialiser.prototype._emitReady = function() {
	this.isReady = true;
	this.emit( 'ready' );
};

/**
 * Logs error messages
 *
 * Since the logger is a dependency in its own right, it can't be relied upon
 * here. If it is available, it will be used, otherwise the error will be logged
 * straight to the console
 *
 * @param   {String} message the error message
 *
 * @private
 * @returns {void}
 */
DependencyInitialiser.prototype._logError = function( message ) {
	if( this._options.logger && this._options.logger.isReady ) {
		this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.PLUGIN_ERROR, message );
	} else {
		console.error( 'Error while initialising dependency' );
		console.error( message );
	}
};

module.exports = DependencyInitialiser;
