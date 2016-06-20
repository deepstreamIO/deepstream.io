'use strict';

const path = require( 'path' );
const url = require( 'url' );
const OBJECT = 'object';

/**
 * Returns a unique identifier
 *
 * @returns {String} uid
 */
exports.getUid = function() {
	return Date.now().toString( 36 ) + '-' + ( Math.random() * 10000000000000000000 ).toString( 36 );
};

/**
 * Calls <callback> once all <emitters> have emitted <event>
 *
 * @param {Array} emitters Array of objects extending events.EventEmitter
 * @param {String} event
 * @param {Function} callback Will be called once every emitter has emitted the event
 *
 * @public
 * @returns {void}
 */
exports.combineEvents = function( emitters, event, callback ) {
	var i;
	var count = 0;
	var increment = function() {
		count++;

		if( count === emitters.length ) {
			callback();
		}
	};

	for( i = 0; i < emitters.length; i++ ) {
			emitters[ i ].once( event, increment );
	}
};

/**
 * Takes a key-value map and returns
 * a map with { value: key } of the old map
 *
 * @param  {Object} map
 *
 * @public
 * @return {Object} reversed map
 */
exports.reverseMap = function( map ) {
	var reversedMap = {}, key;

	for( key in map ) {
		reversedMap[ map[ key ] ] = key;
	}

	return reversedMap;
};

/**
 * Extended version of the typeof operator. Also supports 'array'
 * and 'url' to check for valid URL schemas
 *
 * @param   {Mixed}   input
 * @param   {String}  expectedType
 *
 * @public
 * @returns {Boolean}
 */
exports.isOfType = function( input, expectedType ) {
	if( expectedType === 'array' ) {
		return Array.isArray( input );
	} else if( expectedType === 'url' ) {
		return !!url.parse( input ).host;
	} else {
		return typeof input === expectedType;
	}
};

/**
 * Takes a map and validates it against a basic
 * json schema in the form { key: type }
 *
 * @param   {Object}  map        the map to validate
 * @param   {Boolean} throwError if true, errors will be thrown rather than returned
 * @param   {Object}  schema     json schema in the form { key: type }
 *
 * @public
 * @returns {Boolean|Error}
 */
exports.validateMap = function( map, throwError, schema ) {
	var error, key;

	for( key in schema ) {
		if( typeof map[ key ] === 'undefined' ) {
			error = new Error( 'Missing key ' + key );
			break;
		}

		if( !exports.isOfType( map[ key ], schema[ key ] ) ) {
			error = new Error( 'Invalid type ' + typeof map[ key ] + ' for ' + key );
			break;
		}
	}

	if( error ) {
		if( throwError ) {
			throw error;
		} else {
			return error;
		}
	} else {
		return true;
	}
};

/**
 * Tests have shown that JSON stringify outperforms any attempt of
 * a code based implementation by 50% - 100% whilst also handling edge-cases and keeping implementation
 * complexity low.
 *
 * If ES6/7 ever decides to implement deep copying natively (what happened to Object.clone? that was briefly
 * a thing...), let's switch it for the native implementation. For now though, even Object.assign({}, obj) only
 * provides a shallow copy.
 *
 * Please find performance test results backing these statements here:
 *
 * http://jsperf.com/object-deep-copy-assign
 *
 * @param   {Mixed} obj the object that should be cloned
 *
 * @public
 * @returns {Mixed} clone
 */
exports.deepCopy = function( obj ) {
	if( typeof obj === OBJECT ) {
		return JSON.parse( JSON.stringify( obj ) );
	} else {
		return obj;
	}
};

/**
 * Multi Object recoursive merge
 *
 * @param {Object} multiple objects to be merged into each other recoursively
 *
 * @public
 * @returns {Object} merged result
 */
exports.merge = function() {
	var result = {};
	var objs = Array.prototype.slice.apply( arguments );
	var i;

	var _merge = ( objA, objB ) => {
		var key;

		for( key in objB ) {
			if( objB[ key ] && objB[ key ].constructor === Object ) {
				objA[ key ] = objA[ key ] || {};
				_merge( objA[ key ], objB[ key ] );
			} else if( objB[ key ] !== undefined ) {
				objA[ key ] = objB[ key ];
			}
		}
	};

	for( i = 0; i < objs.length; i++ ) {
		_merge( result, objs[ i ] );
	}

	return result;
};