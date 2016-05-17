var C = require( '../constants/constants' );
var utils = require( '../utils/utils' );
var actionToKey = utils.reverseMap( C.ACTIONS );
var RULES_MAP = {};
var RULE_TYPES = {};

/**
 * Different rule types support different features. Generally, all rules can
 * use cross referencing _() to reference records, but only record writes, incoming events
 * or RPC requests carry data and only existing records have a concept of oldData
 *
 * @type {Object}
 */
RULE_TYPES.CREATE = 	{ name: 'create', 		data: false, 	oldData: false };
RULE_TYPES.READ = 		{ name: 'read', 		data: false, 	oldData: true };
RULE_TYPES.WRITE = 		{ name: 'write', 		data: true, 	oldData: true };
RULE_TYPES.DELETE = 	{ name: 'delete', 		data: false, 	oldData: true };
RULE_TYPES.LISTEN = 	{ name: 'listen', 		data: false, 	oldData: false };
RULE_TYPES.PUBLISH = 	{ name: 'publish', 		data: true, 	oldData: false };
RULE_TYPES.SUBSCRIBE = 	{ name: 'subscribe', 	data: true, 	oldData: false };
RULE_TYPES.PROVIDE = 	{ name: 'provide', 		data: false, 	oldData: false };
RULE_TYPES.REQUEST = 	{ name: 'request', 		data: true, 	oldData: false };

/**
 * This class maps topic / action combinations to applicable
 * rules. It combines actions of a similar character (e.g. READ,
 * SNAPSHOT, HAS) into high level permissions (e.g. read)
 *
 * Lower level permissioning on a per action basis can still be achieved
 * by virtue of using the action variable within the rule, e.g.
 *
 * {
 * 		//allow read, but not listen
 * 		'read': 'user.id === $userId && action !== LISTEN'
 * }
 */
RULES_MAP[ C.TOPIC.RECORD ] = {};
RULES_MAP[ C.TOPIC.RECORD ].section = 'record';
RULES_MAP[ C.TOPIC.RECORD ].actions = {};
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.READ ] = RULE_TYPES.READ;
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.HAS ] = RULE_TYPES.READ;
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.SNAPSHOT ] = RULE_TYPES.READ;
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.LISTEN ] = RULE_TYPES.LISTEN;
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.LISTEN_SNAPSHOT ] = RULE_TYPES.LISTEN;
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.CREATE ] = RULE_TYPES.CREATE;
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.UPDATE ] = RULE_TYPES.WRITE;
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.PATCH ] = RULE_TYPES.WRITE;
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.DELETE ] = RULE_TYPES.DELETE;

RULES_MAP[ C.TOPIC.EVENT ] = {};
RULES_MAP[ C.TOPIC.EVENT ].section = 'event';
RULES_MAP[ C.TOPIC.EVENT ].actions = {};
RULES_MAP[ C.TOPIC.EVENT ].actions[ C.ACTIONS.LISTEN ] = RULE_TYPES.LISTEN;
RULES_MAP[ C.TOPIC.EVENT ].actions[ C.ACTIONS.SUBSCRIBE ] = RULE_TYPES.SUBSCRIBE;
RULES_MAP[ C.TOPIC.EVENT ].actions[ C.ACTIONS.EVENT ] = RULE_TYPES.PUBLISH;

RULES_MAP[ C.TOPIC.RPC ] = {};
RULES_MAP[ C.TOPIC.RPC ].section = 'rpc';
RULES_MAP[ C.TOPIC.RPC ].actions = {};
RULES_MAP[ C.TOPIC.RPC ].actions[ C.ACTIONS.SUBSCRIBE ] = RULE_TYPES.PROVIDE;
RULES_MAP[ C.TOPIC.RPC ].actions[ C.ACTIONS.REQUEST ] = RULE_TYPES.REQUEST;

/**
 * Returns a map of applicable rule-types for a topic
 * action combination
 *
 * @param   {Message} message a parsed and validated deepstream.io message
 *
 * @public
 * @returns {Object} ruleTypes a map with <String> section, <Array> rules, <String> action
 */
exports.getRulesForMessage = function( message ) {
	if( RULES_MAP[ message.topic ] === undefined ) {
		return null;
	}

	if( RULES_MAP[ message.topic ].actions[ message.action ] === undefined ) {
		return null;
	}

	return {
		section: RULES_MAP[ message.topic ].section,
		type: RULES_MAP[ message.topic ].actions[ message.action ].name,
		action: actionToKey[ message.action ]
	};
};

/**
 * Returns true if a given rule supports references to incoming data
 *
 * @param   {String} type one of RULE_TYPES
 *
 * @public
 * @returns {Boolean}
 */
exports.supportsData = function( type ) {
	return RULE_TYPES[ type.toUpperCase() ].data;
};

/**
 * Returns true if a given rule supports references to existing data
 *
 * @param   {String} type one of RULE_TYPES
 *
 * @public
 * @returns {Boolean}
 */
exports.supportsOldData = function( type ) {
	return RULE_TYPES[ type.toUpperCase() ].oldData;
};