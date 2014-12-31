var SPLIT_REG_EXP = /[\.\[\]]/g,
	ASTERISK = '*';

var JsonPath = function( path ) {
	this._path = path;
	this._tokens = [];
	this._tokenize();
};

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

		if( part === ASTERISK ) {
			this._tokens.push( true );
			continue;
		}

		this._tokens.push( part );
	}
};

module.exports = JsonPath;