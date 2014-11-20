/**
 * Returns a unique identifier
 *
 * @returns {String} uid
 */
exports.getUid = function() {
	return Date.now().toString( 36 ) + '-' + ( Math.random() * 10000000000000000000 ).toString( 36 );
};