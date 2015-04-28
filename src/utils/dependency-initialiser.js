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
	this.isReady = true;

	this._options = options;
	this._dependency = options[ name ];
	this._name = name;
	this._timeout = null;

	if( this._dependency.isReady ) {
		clearTimeout( this._timeout );
		this._onReady();
	} else {
		this._timeout = setTimeout( this._onTimeout.bind( this ), this._options.dependencyInitialisationTimeout );
		this._dependency.once( 'ready', this._onReady.bind( this ) );
		this._dependency.on( 'error', this._onError.bind( this ) );
	}
};

utils.inherits( DependencyInitialiser, EventEmitter );

/**
 * Callback for succesfully initialised dependencies
 *
 * @private
 * @returns {void}
 */
DependencyInitialiser.prototype._onReady = function() {
	clearTimeout( this._timeout );
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, this._name + ' ready' );
	process.nextTick( this._emitReady.bind( this ) );
};

/**
 * Callback for dependencies that weren't initialised in time
 *
 * @private
 * @returns {void}
 */
DependencyInitialiser.prototype._onTimeout = function() {
	this._options.logger.log( C.LOG_LEVEL.ERROR, C.EVENT.ERROR, this._name + ' wasn\'t initialised in time' );
	process.exit();
};

/**
* Handles errors emitted by the dependency. If the error is emitted
* before the dependency is ready, it is logged to the console straight
* away. (The logger is a dependency in its own right, so can't be relied
* upon here)
*
* @todo Should errors during dependency initialisation be fatal?
*
* @param {Error|String} error
*
* @private
* @returns {void}
*/
DependencyInitialiser.prototype._onError = function( error ) {
	if( this.isReady !== true ) {
		console.log( 'Error while initialising ' + this._name );
		console.log( error.toString() );
	} else {
		// TODO handle dependency runtime errors
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

module.exports = DependencyInitialiser;