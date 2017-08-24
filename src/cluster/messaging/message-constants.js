'use strict'

/* eslint-disable comma-spacing, no-multi-spaces */

const TOPIC                   = {}
TOPIC.CONNECTION              = { TEXT:'C'         , BYTE: 0x00 }
TOPIC.AUTH                    = { TEXT:'A'         , BYTE: 0x01 }
TOPIC.ERROR                   = { TEXT:'X'         , BYTE: 0x02 }
TOPIC.EVENT                   = { TEXT:'E'         , BYTE: 0x03 }
TOPIC.RECORD                  = { TEXT:'R'         , BYTE: 0x04 }
TOPIC.RPC                     = { TEXT:'P'         , BYTE: 0x05 }
TOPIC.PRESENCE                = { TEXT:'U'         , BYTE: 0x06 }
TOPIC.CLUSTER                 = { TEXT:'CL'        , BYTE: 0x07 }
TOPIC.STATE_REGISTRY          = { TEXT:'STATE_REG' , BYTE: 0x08 }
TOPIC.PRIVATE                 = { TEXT:'PRIVATE/'  , BYTE: 0x09 }

// TOPIC.PUBLISHED_SUBSCRIPTIONS = { TEXT: 'PS' , BYTE: 0x0A }
// TOPIC.LISTEN_PATTERNS         = { TEXT: 'LIP', BYTE: 0x0B }
// TOPIC.SUBSCRIPTIONS           = { TEXT: 'SUB', BYTE: 0x0C }
// TOPIC.ONLINE_USERS            = { TEXT: 'O'  , BYTE: 0x07 }
// TOPIC.LISTEN                  = { TEXT: 'LI' , BYTE: 0x0C }

const ACTIONS = {}

ACTIONS.CONNECTION                    = {}
ACTIONS.CONNECTION.ERROR              = { TEXT: 'E'  , BYTE: 0x17 }
ACTIONS.CONNECTION.PING               = { TEXT: 'PI' , BYTE: 0x00 }
ACTIONS.CONNECTION.PONG               = { TEXT: 'PO' , BYTE: 0x01 }
ACTIONS.CONNECTION.ACK                = { TEXT: 'A'  , BYTE: 0x02 }
ACTIONS.CONNECTION.CHALLENGE          = { TEXT: 'CH' , BYTE: 0x22 }
ACTIONS.CONNECTION.CHALLENGE_RESPONSE = { TEXT: 'CHR', BYTE: 0x23 }
ACTIONS.CONNECTION.REJECTION          = { TEXT: 'REJ', BYTE: 0x03 }

ACTIONS.AUTH          = {}
ACTIONS.AUTH.ERROR    = { TEXT: 'E'  , BYTE: 0x17 }
ACTIONS.AUTH.REQUEST  = { TEXT: 'REQ', BYTE: 0x00 }
ACTIONS.AUTH.ACK      = { TEXT: 'A'  , BYTE: 0x02 }
ACTIONS.AUTH.RESPONSE = { TEXT: 'RES', BYTE: 0x02 }

ACTIONS.EVENT                                  = {}
ACTIONS.EVENT.ERROR                            = { TEXT: 'E'   , BYTE: 0x17 }
ACTIONS.EVENT.EVENT                            = { TEXT: 'EVT' , BYTE: 0x16 }
ACTIONS.EVENT.SUBSCRIBE                        = { TEXT: 'S'   , BYTE: 0x08 }
ACTIONS.EVENT.SUBSCRIBE_ACK                    = { TEXT: 'S_A' , BYTE: 0x0C }
ACTIONS.EVENT.UNSUBSCRIBE                      = { TEXT: 'US'  , BYTE: 0x09 }
ACTIONS.EVENT.UNSUBSCRIBE_ACK                  = { TEXT: 'US_A', BYTE: 0x0D }
ACTIONS.EVENT.LISTEN_SNAPSHOT                  = { TEXT: 'LSN' , BYTE: 0x0C }
ACTIONS.EVENT.LISTEN                           = { TEXT: 'L'   , BYTE: 0x0D }
ACTIONS.EVENT.LISTEN_ACK                       = { TEXT: 'L_A' , BYTE: 0x0D }
ACTIONS.EVENT.UNLISTEN                         = { TEXT: 'UL'  , BYTE: 0x0E }
ACTIONS.EVENT.UNLISTEN_ACK                     = { TEXT: 'UL_A', BYTE: 0x0E }
ACTIONS.EVENT.LISTEN_ACCEPT                    = { TEXT: 'LA'  , BYTE: 0x0F }
ACTIONS.EVENT.LISTEN_REJECT                    = { TEXT: 'LR'  , BYTE: 0x10 }
ACTIONS.EVENT.SUBSCRIPTION_HAS_PROVIDER        = { TEXT: 'SH'  , BYTE: 0x00 }
ACTIONS.EVENT.SUBSCRIPTIONS_FOR_PATTERN_FOUND  = { TEXT: 'SF'  , BYTE: 0x00 }
ACTIONS.EVENT.SUBSCRIPTION_FOR_PATTERN_FOUND   = { TEXT: 'SP'  , BYTE: 0x00 }
ACTIONS.EVENT.SUBSCRIPTION_FOR_PATTERN_REMOVED = { TEXT: 'SR'  , BYTE: 0x00 }

ACTIONS.RECORD                                  = {}
ACTIONS.RECORD.ERROR                            = { TEXT: 'E'   , BYTE: 0x00 }
ACTIONS.RECORD.READ                             = { TEXT: 'R'   , BYTE: 0x01 }
ACTIONS.RECORD.CREATE                           = { TEXT: 'C'   , BYTE: 0x02 }
ACTIONS.RECORD.CREATEORREAD                     = { TEXT: 'CR'  , BYTE: 0x03 }
ACTIONS.RECORD.CREATEORREAD_WITH_WRITE_ACK      = { TEXT: 'CRWA', BYTE: 0x04 }
ACTIONS.RECORD.CREATEANDUPDATE                  = { TEXT: 'CU'  , BYTE: 0x05 }
ACTIONS.RECORD.CREATEANDUPDATE_WITH_WRITE_ACK   = { TEXT: 'CUWA', BYTE: 0x06 }
ACTIONS.RECORD.UPDATE                           = { TEXT: 'U'   , BYTE: 0x07 }
ACTIONS.RECORD.PATCH                            = { TEXT: 'P'   , BYTE: 0x08 }
ACTIONS.RECORD.DELETE                           = { TEXT: 'D'   , BYTE: 0x09 }
ACTIONS.RECORD.DELETE_ACK                       = { TEXT: 'AD'  , BYTE: 0x0A }
ACTIONS.RECORD.SUBSCRIBE                        = { TEXT: 'S'   , BYTE: 0x0B }
ACTIONS.RECORD.SUBSCRIBE_ACK                    = { TEXT: 'S_A' , BYTE: 0x0C }
ACTIONS.RECORD.UNSUBSCRIBE                      = { TEXT: 'US'  , BYTE: 0x0D }
ACTIONS.RECORD.UNSUBSCRIBE_ACK                  = { TEXT: 'US_A', BYTE: 0x0D }
ACTIONS.RECORD.HAS                              = { TEXT: 'H'   , BYTE: 0x0E }
ACTIONS.RECORD.SNAPSHOT                         = { TEXT: 'SN'  , BYTE: 0x0F }
ACTIONS.RECORD.LISTEN_SNAPSHOT                  = { TEXT: 'LSN' , BYTE: 0x10 }
ACTIONS.RECORD.LISTEN                           = { TEXT: 'L'   , BYTE: 0x11 }
ACTIONS.RECORD.LISTEN_ACK                       = { TEXT: 'L_A' , BYTE: 0x0D }
ACTIONS.RECORD.UNLISTEN                         = { TEXT: 'UL'  , BYTE: 0x12 }
ACTIONS.RECORD.UNLISTEN_ACK                     = { TEXT: 'UL_A', BYTE: 0x0E }
ACTIONS.RECORD.LISTEN_ACCEPT                    = { TEXT: 'LA'  , BYTE: 0x03 }
ACTIONS.RECORD.LISTEN_REJECT                    = { TEXT: 'LR'  , BYTE: 0x04 }
ACTIONS.RECORD.SUBSCRIPTION_HAS_PROVIDER        = { TEXT: 'SH'  , BYTE: 0x05 }
ACTIONS.RECORD.SUBSCRIPTIONS_FOR_PATTERN_FOUND  = { TEXT: 'SF'  , BYTE: 0x06 }
ACTIONS.RECORD.SUBSCRIPTION_FOR_PATTERN_FOUND   = { TEXT: 'SP'  , BYTE: 0x07 }
ACTIONS.RECORD.SUBSCRIPTION_FOR_PATTERN_REMOVED = { TEXT: 'SR'  , BYTE: 0x08 }
ACTIONS.RECORD.WRITE_ACKNOWLEDGEMENT            = { TEXT: 'WA'  , BYTE: 0x09 }

ACTIONS.RPC                 = {}
ACTIONS.RPC.ERROR           = { TEXT: 'E'   , BYTE: 0x00 }
ACTIONS.RPC.REQUEST         = { TEXT: 'REQ' , BYTE: 0x01 }
ACTIONS.RPC.REQUEST_ACK     = { TEXT: 'AREQ', BYTE: 0x02 }
ACTIONS.RPC.RESPONSE        = { TEXT: 'RES' , BYTE: 0x03 }
ACTIONS.RPC.REJECTION       = { TEXT: 'REJ' , BYTE: 0x04 }
ACTIONS.RPC.SUBSCRIBE       = { TEXT: 'S'   , BYTE: 0x05 }
ACTIONS.RPC.SUBSCRIBE_ACK   = { TEXT: 'S_A' , BYTE: 0x0C }
ACTIONS.RPC.UNSUBSCRIBE     = { TEXT: 'US'  , BYTE: 0x06 }
ACTIONS.RPC.UNSUBSCRIBE_ACK = { TEXT: 'US_A', BYTE: 0x0D }

ACTIONS.PRESENCE                 = {}
ACTIONS.PRESENCE.ERROR           = { TEXT: 'E'   , BYTE: 0x00 }
ACTIONS.PRESENCE.PRESENCE_JOIN   = { TEXT: 'PNJ' , BYTE: 0x01 }
ACTIONS.PRESENCE.PRESENCE_LEAVE  = { TEXT: 'PNL' , BYTE: 0x02 }
ACTIONS.PRESENCE.SUBSCRIBE       = { TEXT: 'S'   , BYTE: 0x03 }
ACTIONS.PRESENCE.SUBSCRIBE_ACK   = { TEXT: 'S_A' , BYTE: 0x0C }
ACTIONS.PRESENCE.UNSUBSCRIBE     = { TEXT: 'US'  , BYTE: 0x04 }
ACTIONS.PRESENCE.UNSUBSCRIBE_ACK = { TEXT: 'US_A', BYTE: 0x0D }
ACTIONS.PRESENCE.QUERY           = { TEXT: 'Q'   , BYTE: 0x05 }

ACTIONS.CLUSTER                         = {}
ACTIONS.CLUSTER.ERROR                   = { TEXT: 'E'    , BYTE: 0x00 }
ACTIONS.CLUSTER.PING                    = { TEXT: 'PI'   , BYTE: 0x01 }
ACTIONS.CLUSTER.PONG                    = { TEXT: 'PO'   , BYTE: 0x02 }
ACTIONS.CLUSTER.IDENTIFICATION_REQUEST  = { TEXT: 'WHO'  , BYTE: 0x03 }
ACTIONS.CLUSTER.IDENTIFICATION_RESPONSE = { TEXT: 'IAM'  , BYTE: 0x04 }
ACTIONS.CLUSTER.KNOWN_PEERS             = { TEXT: 'KNOWN', BYTE: 0x05 }
ACTIONS.CLUSTER.REJECT                  = { TEXT: 'REJC' , BYTE: 0x06 }
ACTIONS.CLUSTER.REJECT_DUPLICATE        = { TEXT: 'REJD' , BYTE: 0x07 }
ACTIONS.CLUSTER.CLOSE                   = { TEXT: 'CLOSE', BYTE: 0x08 }
ACTIONS.CLUSTER.MESSAGE                 = { TEXT: 'MSG'  , BYTE: 0x09 }

ACTIONS.STATE_REGISTRY                                      = {}
ACTIONS.STATE_REGISTRY.LOCK_REQUEST                         = { TEXT: 'LRQ'                                 , BYTE: 0x00 }
ACTIONS.STATE_REGISTRY.LOCK_RESPONSE                        = { TEXT: 'LRP'                                 , BYTE: 0x01 }
ACTIONS.STATE_REGISTRY.LOCK_RELEASE                         = { TEXT: 'LRL'                                 , BYTE: 0x02 }
ACTIONS.STATE_REGISTRY.PUBLISHED_SUBSCRIPTIONS              = { TEXT: 'PS'                                  , BYTE: 0x04 }
ACTIONS.STATE_REGISTRY.LISTEN_PATTERNS                      = { TEXT: 'LIP'                                 , BYTE: 0x05 }
ACTIONS.STATE_REGISTRY.LEADER_PRIVATE                       = { TEXT: 'LP_'                                 , BYTE: 0x06 }
ACTIONS.STATE_REGISTRY.SUBSCRIPTIONS                        = { TEXT: 'SUB'                                 , BYTE: 0x07 }
ACTIONS.STATE_REGISTRY.ONLINE_USERS                         = { TEXT: 'O'                                   , BYTE: 0x08 }
ACTIONS.STATE_REGISTRY.DISTRIBUTED_STATE_ADD                = { TEXT: 'DISTRIBUTED_STATE_ADD'               , BYTE: 0x09 }
ACTIONS.STATE_REGISTRY.DISTRIBUTED_STATE_REMOVE             = { TEXT: 'DISTRIBUTED_STATE_REMOVE'            , BYTE: 0x0A }
ACTIONS.STATE_REGISTRY.DISTRIBUTED_STATE_REQUEST_FULL_STATE = { TEXT: 'DISTRIBUTED_STATE_REQUEST_FULL_STATE', BYTE: 0x0B }
ACTIONS.STATE_REGISTRY.DISTRIBUTED_STATE_FULL_STATE         = { TEXT: 'DISTRIBUTED_STATE_FULL_STATE'        , BYTE: 0x0C }

const OPTIONS = {}

OPTIONS.PAYLOAD_ENCODING = {}
OPTIONS.PAYLOAD_ENCODING.JSON = 0x00

exports.TOPIC = TOPIC
exports.TOPIC_BYTE_TO_TEXT = convertMap(TOPIC, 'BYTE', 'TEXT')
exports.TOPIC_TEXT_TO_BYTE = convertMap(TOPIC, 'TEXT', 'BYTE')

exports.ACTIONS = ACTIONS
for (const key in ACTIONS) {
  ACTIONS[`${key}_BYTE_TO_TEXT`] = convertMap(ACTIONS[key], 'BYTE', 'TEXT')
  ACTIONS[`${key}_TEXT_TO_BYTE`] = convertMap(ACTIONS[key], 'TEXT', 'BYTE')
  ACTIONS[`${key}_BYTES`] = specifyMap(ACTIONS[key], 'BYTE')
}

exports.OPTIONS = OPTIONS

/**
 * convertMap({ a: { x: 1 }, b: { x: 2 }, c: { x : 3 } }, 'x', 'y')
 *  ===
 * { a: { y: 1 }, b: { y: 2 }, c: { y : 3 } }
 */
function convertMap (map, from, to) {
  const result = {}

  for (const key in map) {
    result[map[key][from]] = map[key][to]
  }

  return result
}

/**
 * specifyMap({ a: { x: 1 }, b: { x: 2 }, c: { x : 3 } }, 'x')
 *  ===
 * { a: 1, b: 2, c: 3 }
 */
function specifyMap (map, innerKey) {
  const result = {}

  for (const key in map) {
    result[key] = map[key][innerKey]
  }

  return result
}
