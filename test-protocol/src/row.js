var EventEmitter = require( 'events' ).EventEmitter,
	utils = require( 'util' );
	
	require( 'colors' );

var Row = function( data, clients ) {
	
	this._results = [];
	this._data = data;
	this._comment = false;
	
	/**
	 * Just a comment, move on
	 */
	if( data[ 0 ].trim()[ 0 ] === '#' ) {
		this._comment = this._parseMsg( data[ 0 ] );
		this._done( 0, true );
	}

	for( var i = 0; i < data.length; i++ ) {
		this._processEntry( i, data[ i ], clients[ i ] );
	}
};

utils.inherits( Row, EventEmitter );

Row.prototype.isValid = function() {
	for( var i = 0; i < this._results.length; i++ ) {
		if( this._results[ i ] !== true ) {
			return false;
		}
	}
	
	return true;
};

Row.prototype._processEntry = function( index, entry, client ) {
	entry = entry.trim();
	
	/**
	 * Empty String - nothing to do here
	 */
	if( entry.length === 0 ) {
		this._done( index, true );
	}
	
	/**
	 * Outgoing message - send it
	 */
	else if( entry[ 0 ] === '>' ) {
		client.send( this._parseMsg( entry ) );
		this._done( index, true );
		return;
	}
	
	/**
	 * Incoming message - subscribe to it
	 */
	else if( entry[ 0 ] === '<' ) {
		client.once( 'message', this._check.bind( this, index, this._parseMsg( entry ) ) );
	}
};

Row.prototype._parseMsg = function( entry ) {
	return entry.substr( 1 ).trim().replace( /\|/g, String.fromCharCode( 31 ) );	
};

Row.prototype._done = function( index, result ) {
	this._results[ index ] = result; 

	for( var i = 0; i < this._data.length; i++ ) {
		if( this._results[ i ] === undefined ) {
			return;
		}
	}
	
	process.nextTick( this.emit.bind( this, 'done' ) );
};

Row.prototype._check = function( index, expected, actual ) {
	if( expected === actual ) {
		this._done( index, true );
	} else {
		this._done( index, actual );
	}
};

Row.prototype.log = function( maxEntrySizes ) {
	var msg = [],
		part,
		i, j;
		
	if( this._comment ) {
		console.log( '' );
		console.log( this._comment );
		return;
	}
	
	for( i = 0; i < this._data.length; i++ ) {
		if( this._results[ i ] === true ) {
			part = this._data[ i ].green;
		} else {
			part = this._data[ i ] + ' (' + this._results[ i ] + ')';
			part = part.red;
		}
		

		for( j = part.length; j < maxEntrySizes[ i ]; j++ ) {
			part += ' ';
		}
		
		msg.push( part );
	}
	
	console.log( msg.join( '|  ' ) );
};

module.exports = Row;