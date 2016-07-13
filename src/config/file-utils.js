const fs = require( 'fs' );
const path = require( 'path' );

/**
* Append the global library directory as the prefix to any path
* used here
*
* @param {String} filePath
*
* @private
* @returns {String} file path with the library prefix used
*/
exports.lookupLibRequirePath = function( filePath ) {
	return exports.lookupRequirePath( filePath, global.deepstreamLibDir );
};

/**
* Append the global configuration directory as the prefix to any path
* used here
*
* @param {String} filePath
*
* @private
* @returns {String} file path with the configuration prefix used
*/
exports.lookupConfRequirePath = function( filePath ) {
	return exports.lookupRequirePath( filePath, global.deepstreamConfDir );
};

/**
 * Resolve a path which will be passed to *require*.
 *
 * If a prefix is not set the filePath will be returned
 * Otherwise it will either replace return a new path prepended with the prefix.
 * If the prefix is not an absolute path it will also prepend the CWD.
 *
 * file        || relative (starts with .) | absolute | else (npm module path)
 * -----------------------------------------------------------------------------
 * *prefix     || *CWD + prefix + file     | file     | *CWD + prefix + file
 * *no prefix  ||  CWD + file              | file     | file (resolved by nodes require)
 *
 * *CWD = ignore CWD if prefix is absolute
 *
 * @param {String} filePath
 * @param {String} prefix
 *
 * @private
 * @returns {String} file path with the prefix
 */
exports.lookupRequirePath = function( filePath, prefix ) {
	if ( path.parse( filePath ).root !== '' ) {
		// filePath is absolute
		return filePath;
	} else if ( filePath[0] !== '.' ) {
		// filePath is not relative (and not absolute)
		if ( prefix == null ) {
			return filePath;
		} else {
			return resolvePrefixAndFile( filePath, prefix );
		}
	} else {
		// filePath is relative, starts with .
		if ( prefix == null ) {
			return path.resolve( process.cwd(), filePath );
		} else {
			return resolvePrefixAndFile( filePath, prefix );
		}
	}
};

/**
 * Returns true if a file exists for a given path
 *
 * @param   {String} path
 *
 * @private
 * @returns {Boolean} exists
 */
exports.fileExistsSync = function( filePath ) {
	try{
		fs.lstatSync( filePath );
		return true;
	} catch( e ) {
		return false;
	}
};

/**
* Append the prefix to the current working directory,
* or use it as an absolute path
*
* @param   {String} nonAbsoluteFilePath
* @param   {String} prefix
*
* @private
* @returns {String} resolvedPath
*/
function resolvePrefixAndFile( nonAbsoluteFilePath, prefix ) {
	if ( path.parse( prefix ).root === '' ) {
		// prefix is not absolute
		return path.resolve( process.cwd(), prefix, nonAbsoluteFilePath );
	} else {
		// prefix is absolute
		return path.resolve( prefix, nonAbsoluteFilePath );
	}
}
