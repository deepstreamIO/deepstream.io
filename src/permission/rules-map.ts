import { ACTIONS, TOPIC } from '../constants'
import { reverseMap } from '../utils/utils'

const actionToKey = reverseMap(ACTIONS)

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
}

/**
 * This class maps topic / action combinations to applicable
 * rules. It combines actions of a similar character (e.g. READ,
 * SNAPSHOT, HAS) into high level permissions (e.g. read)
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
  [TOPIC.RECORD]: {
    section: 'record',
    actions: {
      [ACTIONS.READ]: RULE_TYPES.READ,
      [ACTIONS.HAS]: RULE_TYPES.READ,
      [ACTIONS.SNAPSHOT]: RULE_TYPES.READ,
      [ACTIONS.LISTEN]: RULE_TYPES.LISTEN,
      [ACTIONS.CREATE]: RULE_TYPES.CREATE,
      [ACTIONS.UPDATE]: RULE_TYPES.WRITE,
      [ACTIONS.PATCH]: RULE_TYPES.WRITE,
      [ACTIONS.DELETE]: RULE_TYPES.DELETE,
    },
  },
  [TOPIC.EVENT]: {
    section: 'event',
    actions: {
      [ACTIONS.LISTEN]: RULE_TYPES.LISTEN,
      [ACTIONS.SUBSCRIBE]: RULE_TYPES.SUBSCRIBE,
      [ACTIONS.EVENT]: RULE_TYPES.PUBLISH,
    },
  },
  [TOPIC.RPC]: {
    section: 'rpc',
    actions: {
      [ACTIONS.SUBSCRIBE]: RULE_TYPES.PROVIDE,
      [ACTIONS.REQUEST]: RULE_TYPES.REQUEST,
    },
  },
  [TOPIC.PRESENCE]: {
    section: 'presence',
    actions: {
      [ACTIONS.SUBSCRIBE]: RULE_TYPES.ALLOW,
      [ACTIONS.QUERY]: RULE_TYPES.ALLOW,
    },
  },
}

/**
 * Returns a map of applicable rule-types for a topic
 * action combination
 */
export const getRulesForMessage = (message: Message) => {
  if (RULES_MAP[message.topic] === undefined) {
    return null
  }

  if (RULES_MAP[message.topic].actions[message.action] === undefined) {
    return null
  }

  return {
    section: RULES_MAP[message.topic].section,
    type: RULES_MAP[message.topic].actions[message.action].name,
    action: actionToKey[message.action],
  }
}

/**
 * Returns true if a given rule supports references to incoming data
 */
export const supportsData = function (type: string): boolean {
  return RULE_TYPES[type.toUpperCase()].data
}

/**
 * Returns true if a given rule supports references to existing data
 */
export const supportsOldData = function (type: string): boolean {
  return RULE_TYPES[type.toUpperCase()].oldData
}
