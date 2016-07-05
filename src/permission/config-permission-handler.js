var configValidator = require( './config-validator' );
var configCompiler = require( './config-compiler' );
var rulesMap = require( './rules-map' );
var RuleApplication = require( './rule-application' );
var RuleCache = require( './rule-cache' );
var events = require( 'events' );
var utils = require( 'util' );
var fs = require( 'fs' );
var jsYamlLoader = require( '../config/js-yaml-loader' );
var STRING = 'string';
var UNDEFINED = 'undefined';

/**
 * A permission handler that reads a rules config YAML or JSON, validates
 * its contents, compiles it and executes the permissions that it contains
 * against every incoming message.
 *
 * This is the standard permission handler that deepstream exposes, in conjunction
 * with the default permission.yml it allows everything, but at the same time provides
 * a convenient starting point for permission declarations.
 *
 * @author deepstreamHub GmbH
 * @license [https://github.com/deepstreamIO/deepstream.io/blob/master/LICENSE] MIT
 *
 * @constructor
 * @extends {EventEmitter}
 *
 * @param {Object} options deepstream options
 * @param {[Object]} config  Optional config. If no config is provided, the ConfigPermissionHandler will attempt
 *                           to load it from the path provided in options.path.
 */
var ConfigPermissionHandler = function( options, config ) {
	this._ruleCache = new RuleCache( options );
	this._options = options;
	this._permissionOptions = options.permission.options;
	this._config = null;
	this._recordHandler = null;
	this.isReady = false;
	this.type = 'valve permissions loaded from ' + this._permissionOptions.path;

	if( config ) {
		this.useConfig( config );
	}
};

utils.inherits( ConfigPermissionHandler, events.EventEmitter );

/**
 * Will be invoked with the initialised recordHandler instance by deepstream.io
 *
 * @param {RecordHandler} recordHandler
 *
 * @public
 * @returns {void}
 */
ConfigPermissionHandler.prototype.setRecordHandler = function( recordHandler ) {
	this._recordHandler = recordHandler;
};

/**
 * Will be called by the dependency initialiser once server.start() is called.
 * This gives users a chance to change the path using server.set()
 * first
 *
 * @public
 * @returns {void}
 */
ConfigPermissionHandler.prototype.init = function() {
	if( this._config === null ) {
		this.loadConfig( this._permissionOptions.path );
	}
};

/**
 * Load a configuration file. This will either load a configuration file for the first time at
 * startup or reload the configuration at runtime
 *
 * CLI loadConfig <path>
 *
 * @todo expose this method via the command line interface
 *
 * @param   {String} path the filepath of the permission.yml file
 *
 * @public
 * @returns {void}
 */
ConfigPermissionHandler.prototype.loadConfig = function( filePath ) {
	jsYamlLoader.readAndParseFile( filePath, this._onConfigLoaded.bind( this, filePath ) );
};

/**
 * Validates and compiles a loaded config. This can be called as the result
 * of a config being passed to the permissionHandler upon initialisation,
 * as a result of loadConfig or at runtime
 *
 * CLI useConfig <config>
 *
 * @todo expose this method via the command line interface
 *
 * @param   {Object} config deepstream permissionConfig
 *
 * @public
 * @returns {void}
 */
ConfigPermissionHandler.prototype.useConfig = function( config ) {
	var validationResult = configValidator.validate( config );

	if( validationResult !== true ) {
		this.emit( 'error', 'invalid permission config - ' + validationResult );
		return;
	}

	this._config = configCompiler.compile( config );
	this._ruleCache.reset();
	this._ready();
};

/**
 * Implements the permissionHandler's canPerformAction interface
 * method
 *
 * This is the main entry point for permissionOperations and will
 * be called for every incoming message. This method executes four steps
 *
 * - Check if the incoming message conforms to basic specs
 * - Check if the incoming message requires permissions
 * - Load the applicable permissions
 * - Apply them
 *
 * @param   {String}   username the name of the connected user, as specified in isValidUser
 * @param   {Object}   message  a parsed deepstream message
 * @param   {Function} callback the callback to provide the result
 * @param   {[Object]}   authData additional optional authData as passed to isValidUser
 *
 * @public
 * @interface
 * @returns {void}
 */
ConfigPermissionHandler.prototype.canPerformAction = function( username, message, callback, authData ) {
	if( typeof message.data[ 0 ] !== STRING ) {
		callback( 'invalid message', false );
		return;
	}

	var ruleSpecification = rulesMap.getRulesForMessage( message );
	var name = message.data[ 0 ];
	var ruleData;

	if( ruleSpecification === null ) {
		callback( null, true );
		return;
	}

	ruleData = this._getCompiledRulesForName( name, ruleSpecification );

	new RuleApplication({
		recordHandler: this._recordHandler,
		username: username,
		authData: authData,
		path: ruleData,
		ruleSpecification: ruleSpecification,
		message: message,
		action: ruleSpecification.action,
		regexp: ruleData.regexp,
		rule: ruleData.rule,
		name: name,
		callback: callback,
		logger: this._options.logger,
		permissionOptions: this._permissionOptions,
		options: this._options
	} );
};

/**
 * Evaluates the rules within a section and returns the matching rule for a path.
 * Takes basic specificity (as deduced from the path length) into account and
 * caches frequently used rules for faster access
 *
 * @param   {String} name              the name of the record, event or rpc the rule applies to
 * @param   {Object} ruleSpecification a ruleSpecification as provided by the rules-map
 *
 * @private
 * @returns {Object} compiled rules
 */
ConfigPermissionHandler.prototype._getCompiledRulesForName = function( name, ruleSpecification ) {
	if( this._ruleCache.has( ruleSpecification.section, name, ruleSpecification.type ) ) {
		return this._ruleCache.get( ruleSpecification.section, name, ruleSpecification.type );
	}

	var section = this._config[ ruleSpecification.section ];
	var i = 0;
	var pathLength = 0;
	var result = null;

	for( i; i < section.length; i++ ) {
		if(
			typeof section[ i ].rules[ ruleSpecification.type ] !== UNDEFINED &&
			section[ i ].path.length >= pathLength &&
			section[ i ].regexp.test( name )
		) {
			pathLength = section[ i ].path.length;
			result = {
				path: section[ i ].path,
				regexp: section[ i ].regexp,
				rule: section[ i ].rules[ ruleSpecification.type ]
			};
		}
	}

	if( result ) {
		this._ruleCache.set( ruleSpecification.section, name, ruleSpecification.type, result );
	}

	return result;
};

/**
 * Callback for loadConfig. Parses the incoming configuration string and forwards
 * it to useConfig if no errors occured
 *
 * @param   {Error} loadError a FileSystem Error that occured during the loading of the file
 * @param   {String} data     the content of the permission.yml file as utf-8 encoded string
 *
 * @private
 * @returns {void}
 */
ConfigPermissionHandler.prototype._onConfigLoaded = function( filePath, loadError, config ) {
	if( loadError ) {
		this.emit( 'error', 'error while loading config: ' + loadError.toString() );
		return;
	}
	this.emit( 'config-loaded', filePath );
	this.useConfig( config );
};

/**
 * Sets this permissionHandler to ready. Occurs once the config has been successfully loaded,
 * parsed and compiled
 *
 * @private
 * @returns {void}
 */
ConfigPermissionHandler.prototype._ready = function() {
	if( this.isReady === false ) {
		this.isReady = true;
		this.emit( 'ready' );
	}
};

module.exports = ConfigPermissionHandler;
