var C = require( '../constants/constants' );
var RULES_MAP = {};

RULES_MAP[ C.TOPIC.RECORD ] = {};
RULES_MAP[ C.TOPIC.RECORD ].section = 'record';
RULES_MAP[ C.TOPIC.RECORD ].actions = {};
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.READ ] = [ 'read' ];
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.HAS ] = [ 'read' ];
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.SNAPSHOT ] = [ 'read' ];
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.LISTEN ] = [ 'read' ];
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.LISTEN_SNAPSHOT ] = [ 'read' ];
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.CREATE ] = [ 'write' ];
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.UPDATE ] = [ 'write', 'validate' ];
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.PATCH ] = [ 'write', 'validate' ];
RULES_MAP[ C.TOPIC.RECORD ].actions[ C.ACTIONS.DELETE ] = [ 'write' ];

RULES_MAP[ C.TOPIC.EVENT ] = {};
RULES_MAP[ C.TOPIC.EVENT ].section = 'event';
RULES_MAP[ C.TOPIC.EVENT ].actions = {};
RULES_MAP[ C.TOPIC.EVENT ].actions[ C.ACTIONS.SUBSCRIBE ] = [ 'subscribe' ];
RULES_MAP[ C.TOPIC.EVENT ].actions[ C.ACTIONS.EVENT ] = [ 'publish' ];

RULES_MAP[ C.TOPIC.RPC ] = {};
RULES_MAP[ C.TOPIC.RPC ].section = 'rpc';
RULES_MAP[ C.TOPIC.RPC ].actions = {};
RULES_MAP[ C.TOPIC.RPC ].actions[ C.ACTIONS.SUBSCRIBE ] = [ 'provide' ];
RULES_MAP[ C.TOPIC.RPC ].actions[ C.ACTIONS.REQUEST ] = [ 'request' ];

exports.getRulesForMessage = function( message ) {
	if( RULES_MAP[ message.topic ] === undefined ) {
		return null;
	}

	if( RULES_MAP[ message.topic ].actions[ message.action ] === undefined ) {
		return null;
	}

	return {
		section: RULES_MAP[ message.topic ].section,
		rules: RULES_MAP[ message.topic ].actions[ message.action ]
	};
};