var EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' ),
	colors = require( 'colors' );

var Row = function( row, clients ) {
	
	this.results = [];
	
	this._data = row;
	this._pendingTasks = row.length;
	
	/**
	 * Just a comment, move on
	 */
	if( row[ 0 ].trim()[ 0 ] === '#' ) {
		this._done( true );
	}
	
	for( var i = 0; i < row.length; i++ ) {
		this._processEntry( row[ i ], clients[ i ] );
	}
};

utils.inherits( Row, EventEmitter );

Row.prototype._processEntry = function( entry, client ) {
	
	entry = entry.trim();
	
	/**
	 * Empty String - nothing to do here
	 */
	if( entry.length === 0 ) {
		this._done( true );
		return;
	}
	
	/**
	 * Outgoing message - send it
	 */
	if( entry[ 0 ] === '>' ) {
		client.send( this._parseMsg( entry ) );
		this._done( true );
		return;
	}
	
	if( entry[ 0 ] === '<' ) {
		client.once( 'message', this._check.bind( this, this._parseMsg( entry ) ) );
	}
};

Row.prototype._parseMsg = function( entry ) {
	return entry.substr( 1 ).trim().replace( /\|/g, String.fromCharCode( 31 ) );	
};

Row.prototype._done = function( result ) {
	this.results.push( result );

	if( this.results.length === this._data.length ) {
		this._log();
		process.nextTick( this.emit.bind( this, 'done' ) );
	}
};

Row.prototype._check = function( expected, actual ) {
	this._done( expected === actual ? true : actual );
};

Row.prototype._log = function() {
	var msg = [],
		part,
		i;
	
	for( i = 0; i < this._data.length; i++ ) {
		if( this.results[ i ] === true ) {
			msg.push( this._data[ i ].green );
		} else {
			part = this._data[ i ] + ' (' + this.results[ i ] + ')';
			msg.push( part.red );
		}
		
		console.log( msg.join( '  |  ' ) );
	}
};

module.exports = Row;