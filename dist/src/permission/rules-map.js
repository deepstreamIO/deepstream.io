"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const constants_1 = require("../constants");
/**
 * Different rule types support different features. Generally, all rules can
 * use cross referencing _() to reference records, but only record writes, incoming events
 * or RPC requests carry data and only existing records have a concept of oldData
 */
const RULE_TYPES = {
    CREATE: { name: 'create', data: false, oldData: false },
    READ: { name: 'read', data: false, oldData: true },
    WRITE: { name: 'write', data: true, oldData: true },
    DELETE: { name: 'delete', data: false, oldData: true },
    LISTEN: { name: 'listen', data: false, oldData: false },
    PUBLISH: { name: 'publish', data: true, oldData: false },
    SUBSCRIBE: { name: 'subscribe', data: true, oldData: false },
    PROVIDE: { name: 'provide', data: false, oldData: false },
    REQUEST: { name: 'request', data: true, oldData: false },
    ALLOW: { name: 'allow', data: false, oldData: false },
};
/**
 * This class maps topic / action combinations to applicable
 * rules. It combines actions of a similar character (e.g. READ,
 * SNAPSHOT) into high level permissions (e.g. read)
 *
 * Lower level permissioning on a per action basis can still be achieved
 * by virtue of using the action variable within the rule, e.g.
 *
 * {
 *    //allow read, but not listen
 *    'read': 'user.id === $userId && action !== LISTEN'
 * }
 */
const RULES_MAP = {
    [constants_1.TOPIC.RECORD]: {
        section: 'record',
        actions: {
            [constants_1.RECORD_ACTIONS.READ]: RULE_TYPES.READ,
            [constants_1.RECORD_ACTIONS.HEAD]: RULE_TYPES.READ,
            [constants_1.RECORD_ACTIONS.LISTEN]: RULE_TYPES.LISTEN,
            [constants_1.RECORD_ACTIONS.CREATE]: RULE_TYPES.CREATE,
            [constants_1.RECORD_ACTIONS.UPDATE]: RULE_TYPES.WRITE,
            [constants_1.RECORD_ACTIONS.PATCH]: RULE_TYPES.WRITE,
            [constants_1.RECORD_ACTIONS.DELETE]: RULE_TYPES.DELETE,
        },
    },
    [constants_1.TOPIC.EVENT]: {
        section: 'event',
        actions: {
            [constants_1.EVENT_ACTIONS.LISTEN]: RULE_TYPES.LISTEN,
            [constants_1.EVENT_ACTIONS.SUBSCRIBE]: RULE_TYPES.SUBSCRIBE,
            [constants_1.EVENT_ACTIONS.EMIT]: RULE_TYPES.PUBLISH,
        },
    },
    [constants_1.TOPIC.RPC]: {
        section: 'rpc',
        actions: {
            [constants_1.RPC_ACTIONS.PROVIDE]: RULE_TYPES.PROVIDE,
            [constants_1.RPC_ACTIONS.REQUEST]: RULE_TYPES.REQUEST,
        },
    },
    [constants_1.TOPIC.PRESENCE]: {
        section: 'presence',
        actions: {
            [constants_1.PRESENCE_ACTIONS.SUBSCRIBE]: RULE_TYPES.ALLOW,
            [constants_1.PRESENCE_ACTIONS.SUBSCRIBE_ALL]: RULE_TYPES.ALLOW,
            [constants_1.PRESENCE_ACTIONS.QUERY]: RULE_TYPES.ALLOW,
            [constants_1.PRESENCE_ACTIONS.QUERY_ALL]: RULE_TYPES.ALLOW,
        },
    },
};
/**
 * Returns a map of applicable rule-types for a topic
 * action combination
 */
exports.getRulesForMessage = (message) => {
    if (RULES_MAP[message.topic] === undefined) {
        return null;
    }
    if (RULES_MAP[message.topic].actions[message.action] === undefined) {
        return null;
    }
    return {
        section: RULES_MAP[message.topic].section,
        type: RULES_MAP[message.topic].actions[message.action].name,
        action: message.action,
    };
};
/**
 * Returns true if a given rule supports references to incoming data
 */
exports.supportsData = function (type) {
    return RULE_TYPES[type.toUpperCase()].data;
};
/**
 * Returns true if a given rule supports references to existing data
 */
exports.supportsOldData = function (type) {
    return RULE_TYPES[type.toUpperCase()].oldData;
};
//# sourceMappingURL=rules-map.js.map