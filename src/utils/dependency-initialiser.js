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
	process.nextTick( this.emit.bind( this, 'ready' ) );
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

module.exports = DependencyInitialiser;