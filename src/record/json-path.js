var SPLIT_REG_EXP = /[\.\[\]]/g;

/**
 * This class allows to set or get specific
 * values within a json data structure using
 * string-based paths
 *
 * @param {String} path A path, e.g. users[2].firstname
 *
 * @constructor
 */
var JsonPath = function( path ) {
	this._path = path;
	this._tokens = [];
	this._tokenize();
};

/**
 * Sets the value of the path. If the path (or parts
 * of it) doesn't exist yet, it will be created
 *
 * @param {Object} node
 * @param {Mixed} value
 *
 * @public
 * @returns {void}
 */
JsonPath.prototype.setValue = function( node, value ) {
	for( var i = 0; i < this._tokens.length - 1; i++ ) {
		if( node[ this._tokens[ i ] ] !== undefined ) {
			node = node[ this._tokens[ i ] ];
		}
		else if( this._tokens[ i + 1 ] && !isNaN( this._tokens[ i + 1 ] ) ){
			node = node[ this._tokens[ i ] ] = [];
		}
		else {
			node = node[ this._tokens[ i ] ] = {};
		}
	}

	node[ this._tokens[ i ] ] = value;
};

/**
 * Parses the path. Splits it into
 * keys for objects and indices for arrays.
 *
 * @private
 * @returns {void}
 */
JsonPath.prototype._tokenize = function() {
	var parts = this._path.split( SPLIT_REG_EXP ),
		part,
		i;

	for( i = 0; i < parts.length; i++ ) {
		part = parts[ i ].trim();

		if( part.length === 0 ) {
			continue;
		}

		if( !isNaN( part ) ) {
			this._tokens.push( parseInt( part, 10 ) );
			continue;
		}

		this._tokens.push( part );
	}
};

module.exports = JsonPath;