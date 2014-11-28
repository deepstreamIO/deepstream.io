var C = require( '../constants/constants' ),
	EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' );

var DependencyInitialiser = function( options, name ) {
	this._options = options;
	this._dependency = options[ name ];
	this._name = name;

	if( this._dependency.isReady ) {
		this._onReady();
	} else {
		this._dependency.once( 'ready', this._onReady.bind( this ) );
	}
};

utils.inherits( DependencyInitialiser, EventEmitter );

DependencyInitialiser.prototype._onReady = function() {
	this._options.logger.log( C.LOG_LEVEL.INFO, C.EVENT.INFO, this._name + ' ready' );
	process.nextTick( this.emit.bind( this, 'ready' ) );
};

module.exports = DependencyInitialiser;