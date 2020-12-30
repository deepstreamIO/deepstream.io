import {
  ACTIONS_BYTE_TO_PAYLOAD as ABP,
  ACTIONS_BYTE_TO_TEXT as ABT,
  AUTH_ACTIONS as AA,
  CONNECTION_ACTIONS as CA,
  DEEPSTREAM_TYPES as TYPES,
  EVENT_ACTIONS as EA,
  MESSAGE_PART_SEPERATOR as y,
  MESSAGE_SEPERATOR as x,
  PRESENCE_ACTIONS as UA,
  RECORD_ACTIONS as RA,
  RPC_ACTIONS as PA,
  TOPIC,
  TOPIC_BYTE_TO_TEXT as TBT,
  PAYLOAD_ENCODING,
} from './constants'
import { Message } from '../../../../constants'
import { correlationIdToVersion, bulkNameToCorrelationId } from './message-parser'
const WA = y + JSON.stringify({ writeSuccess: true })
const NWA = y + '{}'
const A = 'A' + y

const genericError = (msg: Message) => `${TBT[msg.topic]}${y}E${y}${msg.correlationId}${y}${msg.parsedData}${x}`
const invalidMessageData = (msg: Message) => `${TBT[msg.topic]}${y}E${y}INVALID_MESSAGE_DATA${y}${msg.data}${x}`
const messagePermissionError = (msg: Message) => `${TBT[msg.topic]}${y}E${y}MESSAGE_PERMISSION_ERROR${y}${msg.name}${ABT[msg.topic][msg.action] ? y + ABT[msg.topic][msg.action] : '' }${msg.correlationId ? y + msg.correlationId : '' }${x}`
const messageDenied = (msg: Message) => {
  let version
  if (msg.topic === TOPIC.RECORD.BYTE && msg.correlationId) {
    version = correlationIdToVersion.get(msg.correlationId!)
    correlationIdToVersion.delete(msg.correlationId!)
    delete msg.correlationId
  }
  return `${TBT[msg.topic]}${y}E${y}MESSAGE_DENIED${y}${msg.name}${ABT[msg.topic][msg.action] ? y + ABT[msg.topic][msg.action] : '' }${msg.originalAction ? y + ABT[msg.topic][msg.originalAction] : '' }${msg.correlationId ? y + msg.correlationId : '' }${version !== undefined ? y + version : '' }${x}`
}
const notSubscribed = (msg: Message) => `${TBT[msg.topic]}${y}E${y}NOT_SUBSCRIBED${y}${msg.name}${x}`
const invalidAuth = (msg: Message) => `A${y}E${y}INVALID_AUTH_DATA${y}${msg.data ? msg.data : 'U' }${x}`
const recordUpdate = (msg: Message) => `R${y}U${y}${msg.name}${y}${msg.version}${y}${msg.data}${msg.isWriteAck ? WA : '' }${x}`
const recordPatch = (msg: Message) => `R${y}P${y}${msg.name}${y}${msg.version}${y}${msg.path}${y}${msg.data}${msg.isWriteAck ? WA : '' }${x}`
const subscriptionForPatternFound = (msg: Message) => `${TBT[msg.topic]}${y}SP${y}${msg.name}${y}${msg.subscription}${x}`
const subscriptionForPatternRemoved = (msg: Message) => `${TBT[msg.topic]}${y}SR${y}${msg.name}${y}${msg.subscription}${x}`
const listen = (msg: Message, isAck: boolean) => `${TBT[msg.topic]}${y}${isAck ? A : '' }L${y}${msg.name}${x}`
const unlisten = (msg: Message, isAck: boolean) => `${TBT[msg.topic]}${y}${isAck ? A : '' }UL${y}${msg.name}${x}`
const listenAccept = (msg: Message) => `${TBT[msg.topic]}${y}LA${y}${msg.name}${y}${msg.subscription}${x}`
const listenReject = (msg: Message) => `${TBT[msg.topic]}${y}LR${y}${msg.name}${y}${msg.subscription}${x}`
const multipleSubscriptions = (msg: Message) => `${TBT[msg.topic]}${y}E${y}MULTIPLE_SUBSCRIPTIONS${y}${msg.name}${x}`

const BUILDERS = {
  [TOPIC.CONNECTION.BYTE]: {
    [CA.ERROR.BYTE]: genericError,
    [CA.CHALLENGE.BYTE]: (msg: Message) => `C${y}CH${x}`,
    [CA.ACCEPT.BYTE]: (msg: Message) => `C${y}A${x}`,
    [CA.REJECTION.BYTE]: (msg: Message) => `C${y}REJ${y}${msg.data}${x}`,
    [CA.REDIRECT.BYTE]: (msg: Message) => `C${y}RED${y}${msg.data}${x}`,
    [CA.PING.BYTE]: (msg: Message) => `C${y}PI${x}`,
    [CA.PONG.BYTE]: (msg: Message) => `C${y}PO${x}`,
    [CA.CONNECTION_AUTHENTICATION_TIMEOUT.BYTE]: (msg: Message) => `C${y}E${y}CONNECTION_AUTHENTICATION_TIMEOUT${x}`,
  },
  [TOPIC.AUTH.BYTE]: {
    [AA.ERROR.BYTE]: genericError,
    [AA.REQUEST.BYTE]: (msg: Message) => `A${y}REQ${y}${msg.data}${x}`,
    [AA.AUTH_SUCCESSFUL.BYTE]: (msg: Message) => `A${y}A${msg.data ? y + msg.data : ''}${x}`,
    [AA.AUTH_UNSUCCESSFUL.BYTE]: invalidAuth,
    [AA.INVALID_MESSAGE_DATA.BYTE]: invalidAuth,
    [AA.TOO_MANY_AUTH_ATTEMPTS.BYTE]: (msg: Message) => `A${y}E${y}TOO_MANY_AUTH_ATTEMPTS${x}`,
  },
  [TOPIC.EVENT.BYTE]: {
    [EA.ERROR.BYTE]: genericError,
    [EA.SUBSCRIBE.BYTE]: (msg: Message, isAck: boolean) => {
      let name = msg.name
      if (isAck) {
        name = bulkNameToCorrelationId.get(msg.correlationId!)
        bulkNameToCorrelationId.delete(msg.correlationId!)
      }
      return `E${y}${isAck ? A : '' }S${y}${name}${x}`
    },
    [EA.UNSUBSCRIBE.BYTE]: (msg: Message, isAck: boolean) => {
      let name = msg.name
      if (isAck) {
        name = bulkNameToCorrelationId.get(msg.correlationId!)
        bulkNameToCorrelationId.delete(msg.correlationId!)
      }
      return `E${y}${isAck ? A : '' }US${y}${name}${x}`
    },
    [EA.EMIT.BYTE]: (msg: Message) => `E${y}EVT${y}${msg.name}${y}${msg.data ? msg.data : 'U'}${x}`,
    [EA.LISTEN.BYTE]: listen,
    [EA.UNLISTEN.BYTE]: unlisten,
    [EA.LISTEN_ACCEPT.BYTE]: listenAccept,
    [EA.LISTEN_REJECT.BYTE]: listenReject,
    [EA.SUBSCRIPTION_FOR_PATTERN_FOUND.BYTE]: subscriptionForPatternFound,
    [EA.SUBSCRIPTION_FOR_PATTERN_REMOVED.BYTE]: subscriptionForPatternRemoved,
    [EA.INVALID_MESSAGE_DATA.BYTE]: invalidMessageData,
    [EA.MESSAGE_DENIED.BYTE]: messageDenied,
    [EA.MESSAGE_PERMISSION_ERROR.BYTE]: messagePermissionError,
    [EA.NOT_SUBSCRIBED.BYTE]: notSubscribed,
    [EA.MULTIPLE_SUBSCRIPTIONS.BYTE]: multipleSubscriptions,
  },
  [TOPIC.RECORD.BYTE]: {
    [RA.ERROR.BYTE]: genericError,
    [RA.HEAD.BYTE]: (msg: Message) => `R${y}HD${y}${msg.name}${x}`,
    [RA.HEAD_RESPONSE.BYTE]: (msg: Message) => `R${y}HD${y}${msg.name}${y}${msg.version}${y}null${x}`,
    [RA.READ.BYTE]: (msg: Message) => `R${y}R${y}${msg.name}${x}`,
    [RA.READ_RESPONSE.BYTE]: (msg: Message) => `R${y}R${y}${msg.name}${y}${msg.version}${y}${msg.data}${x}`,
    [RA.UPDATE.BYTE]: recordUpdate,
    [RA.PATCH.BYTE]: recordPatch,
    [RA.ERASE.BYTE]: (msg: Message) => `R${y}P${y}${msg.name}${y}${msg.version}${y}${msg.path}${y}U${msg.isWriteAck ? WA : '' }${x}`,
    [RA.CREATEANDUPDATE.BYTE]: (msg: Message) => `R${y}CU${y}${msg.name}${y}${msg.version}${y}${msg.data}${msg.isWriteAck ? WA : NWA }${x}`,
    [RA.CREATEANDPATCH.BYTE]: (msg: Message) => `R${y}CU${y}${msg.name}${y}${msg.version}${y}${msg.path}${y}${msg.data}${msg.isWriteAck ? WA : NWA }${x}`,
    [RA.DELETE.BYTE]: (msg: Message, isAck: boolean) => `R${y}${isAck ? A : '' }D${y}${msg.name}${x}`,
    [RA.DELETED.BYTE]: (msg: Message) => `R${y}A${y}D${y}${msg.name}${x}`,
    [RA.DELETE_SUCCESS.BYTE]: (msg: Message) => `R${y}A${y}D${y}${msg.name}${x}`,
    [RA.SUBSCRIBECREATEANDREAD.BYTE]: (msg: Message, isAck: boolean) => {
      if (isAck) {
        return `R${y}A${y}S${y}${msg.name}${x}`
      }
      return `R${y}CR${y}${msg.name}${x}`
    },
    [RA.UNSUBSCRIBE.BYTE]: (msg: Message, isAck: boolean) => {
      let name = msg.name
      if (isAck) {
        name = bulkNameToCorrelationId.get(msg.correlationId!)
        bulkNameToCorrelationId.delete(msg.correlationId!)
      }
      return `R${y}${isAck ? A : '' }US${y}${name}${x}`
    },
    [RA.WRITE_ACKNOWLEDGEMENT.BYTE]: (msg: Message) => {
      return `R${y}WA${y}${msg.name}${y}[${correlationIdToVersion.get(msg.correlationId!)}]${y}${TYPES.NULL}${x}`
    },

    [RA.LISTEN.BYTE]: listen,
    [RA.LISTEN_RESPONSE_TIMEOUT.BYTE]: (msg: Message) => `C${y}PO${x}`,
    [RA.UNLISTEN.BYTE]: unlisten,
    [RA.LISTEN_ACCEPT.BYTE]: listenAccept,
    [RA.LISTEN_REJECT.BYTE]: listenReject,
    [RA.SUBSCRIPTION_FOR_PATTERN_FOUND.BYTE]: subscriptionForPatternFound,
    [RA.SUBSCRIPTION_FOR_PATTERN_REMOVED.BYTE]: subscriptionForPatternRemoved,
    [RA.SUBSCRIPTION_HAS_PROVIDER.BYTE]: (msg: Message) => `R${y}SH${y}${msg.name}${y}T${x}`,
    [RA.SUBSCRIPTION_HAS_NO_PROVIDER.BYTE]: (msg: Message) => `R${y}SH${y}${msg.name}${y}F${x}`,

    [RA.STORAGE_RETRIEVAL_TIMEOUT.BYTE]: (msg: Message) => `R${y}E${y}STORAGE_RETRIEVAL_TIMEOUT${y}${msg.name}${x}`,
    [RA.CACHE_RETRIEVAL_TIMEOUT.BYTE]: (msg: Message) => `R${y}E${y}CACHE_RETRIEVAL_TIMEOUT${y}${msg.name}${x}`,
    [RA.VERSION_EXISTS.BYTE]: (msg: Message) => `R${y}E${y}VERSION_EXISTS${y}${msg.name}${y}${msg.version}${y}${msg.data}${msg.isWriteAck ? WA : ''}${x}`,
    [RA.RECORD_NOT_FOUND.BYTE]: (msg: Message) => `R${y}E${y}RECORD_NOT_FOUND${y}${msg.name}${x}`,

    [RA.INVALID_MESSAGE_DATA.BYTE]: invalidMessageData,
    [RA.MESSAGE_DENIED.BYTE]: messageDenied,
    [RA.MESSAGE_PERMISSION_ERROR.BYTE]: messagePermissionError,
    [RA.NOT_SUBSCRIBED.BYTE]: notSubscribed,
    [RA.MULTIPLE_SUBSCRIPTIONS.BYTE]: multipleSubscriptions,
  },
  [TOPIC.RPC.BYTE]: {
    [PA.ERROR.BYTE]: genericError,
    [PA.PROVIDE.BYTE]: (msg: Message, isAck: boolean) => {
      let name = msg.name
      if (isAck) {
        name = bulkNameToCorrelationId.get(msg.correlationId!)
        bulkNameToCorrelationId.delete(msg.correlationId!)
      }
      return `P${y}${isAck ? A : '' }S${y}${name}${x}`
    },
    [PA.UNPROVIDE.BYTE]: (msg: Message, isAck: boolean) => {
      let name = msg.name
      if (isAck) {
        name = bulkNameToCorrelationId.get(msg.correlationId!)
        bulkNameToCorrelationId.delete(msg.correlationId!)
      }
      return `P${y}${isAck ? A : '' }US${y}${name}${x}`
    },
    [PA.REQUEST.BYTE]: (msg: Message) => `P${y}REQ${y}${msg.name}${y}${msg.correlationId}${y}${msg.data}${x}`,
    [PA.RESPONSE.BYTE]: (msg: Message) => `P${y}RES${y}${msg.name}${y}${msg.correlationId}${y}${msg.data}${x}`,
    [PA.REQUEST_ERROR.BYTE]: (msg: Message) => `P${y}E${y}${msg.data}${y}${msg.name}${y}${msg.correlationId}${x}`,
    [PA.REJECT.BYTE]: (msg: Message) => `P${y}REJ${y}${msg.name}${y}${msg.correlationId}${x}`,
    [PA.ACCEPT.BYTE]: (msg: Message) => `P${y}A${y}REQ${y}${msg.name}${y}${msg.correlationId}${x}`,
    [PA.NO_RPC_PROVIDER.BYTE]: (msg: Message) => `P${y}E${y}NO_RPC_PROVIDER${y}${msg.name}${y}${msg.correlationId}${x}`,
    [PA.INVALID_RPC_CORRELATION_ID.BYTE]: (msg: Message) => `P${y}E${y}INVALID_RPC_CORRELATION_ID${y}${msg.name}${y}${msg.correlationId}${x}`,
    [PA.RESPONSE_TIMEOUT.BYTE]: (msg: Message) => `P${y}E${y}RESPONSE_TIMEOUT${y}${msg.name}${y}${msg.correlationId}${x}`,
    [PA.MULTIPLE_RESPONSE.BYTE]: (msg: Message) => `P${y}E${y}MULTIPLE_RESPONSE${y}${msg.name}${y}${msg.correlationId}${x}`,
    [PA.MULTIPLE_ACCEPT.BYTE]: (msg: Message) => `P${y}E${y}MULTIPLE_ACCEPT${y}${msg.name}${y}${msg.correlationId}${x}`,
    [PA.ACCEPT_TIMEOUT.BYTE]: (msg: Message) => `P${y}E${y}ACCEPT_TIMEOUT${y}${msg.name}${y}${msg.correlationId}${x}`,

    [PA.INVALID_MESSAGE_DATA.BYTE]: invalidMessageData,
    [PA.MESSAGE_DENIED.BYTE]: messageDenied,
    [PA.MESSAGE_PERMISSION_ERROR.BYTE]: messagePermissionError,
    [PA.NOT_PROVIDED.BYTE]: notSubscribed,
    [PA.MULTIPLE_PROVIDERS.BYTE]: multipleSubscriptions,
  },
  [TOPIC.PRESENCE.BYTE]: {
    [UA.ERROR.BYTE]: genericError,
    [UA.SUBSCRIBE.BYTE]: (msg: Message, isAck: boolean) => `U${y}${isAck ? A : '' }S${y}${msg.correlationId ? msg.correlationId + y : '' }${msg.name ? msg.name : msg.data}${x}`,
    [UA.SUBSCRIBE_ALL.BYTE]: (msg: Message, isAck: boolean) => `U${y}${isAck ? A : '' }S${y}S${x}`,
    [UA.UNSUBSCRIBE.BYTE]: (msg: Message, isAck: boolean)  => `U${y}${isAck ? A : '' }US${y}${msg.correlationId ? msg.correlationId + y : '' }${msg.name ? msg.name : msg.data}${x}`,
    [UA.UNSUBSCRIBE_ALL.BYTE]: (msg: Message, isAck: boolean)  => `U${y}${isAck ? A : '' }US${y}US${x}`,
    [UA.QUERY.BYTE]: (msg: Message) => `U${y}Q${y}${msg.correlationId}${y}${msg.data}${x}`,
    [UA.QUERY_RESPONSE.BYTE]: (msg: Message) => `U${y}Q${y}${msg.correlationId}${y}${msg.data}${x}`,
    [UA.QUERY_ALL.BYTE]: (msg: Message) => `U${y}Q${y}Q${x}`,
    [UA.QUERY_ALL_RESPONSE.BYTE]: (msg: Message) => `U${y}Q${(msg.names as string[]).length > 0 ? y + (msg.names as string[]).join(y) : '' }${x}`,
    [UA.PRESENCE_JOIN.BYTE]: (msg: Message) => `U${y}PNJ${y}${msg.name}${x}`,
    [UA.PRESENCE_JOIN_ALL.BYTE]: (msg: Message) => `U${y}PNJ${y}${msg.name}${x}`,
    [UA.PRESENCE_LEAVE.BYTE]: (msg: Message) => `U${y}PNL${y}${msg.name}${x}`,
    [UA.PRESENCE_LEAVE_ALL.BYTE]: (msg: Message) => `U${y}PNL${y}${msg.name}${x}`,

    [UA.INVALID_PRESENCE_USERS.BYTE]: (msg: Message) => `U${y}E${y}INVALID_PRESENCE_USERS${y}${msg.data}${x}`,

    [UA.MESSAGE_DENIED.BYTE]: messageDenied,
    [UA.MESSAGE_PERMISSION_ERROR.BYTE]: messagePermissionError,
    [UA.NOT_SUBSCRIBED.BYTE]: notSubscribed,
    [UA.MULTIPLE_SUBSCRIPTIONS.BYTE]: multipleSubscriptions,
  },
}

/**
 * Creates a deepstream message string, based on the
 * provided parameters
 */
export const getMessage = (message: Message, isAck: boolean = false): string => {
  if (!BUILDERS[message.topic] || !BUILDERS[message.topic][message.action]) {
    console.trace('missing builder for', message, isAck)
    return ''
  }

  const builder = BUILDERS[message.topic][message.action]

  if (
      !message.parsedData && !message.data &&
      (
        (message.topic === TOPIC.RPC.BYTE && (message.action === PA.RESPONSE.BYTE || message.action === PA.REQUEST.BYTE)) ||
        (message.topic === TOPIC.RECORD.BYTE && (message.action === RA.PATCH.BYTE || message.action === RA.ERASE.BYTE))
      )
    ) {
      message.data = 'U'
    } else if (message.parsedData) {
      if (ABP[message.topic][message.action] === PAYLOAD_ENCODING.DEEPSTREAM) {
        message.data = typed(message.parsedData)
      } else {
        message.data = JSON.stringify(message.parsedData)
      }
    } else if (message.data && ABP[message.topic][message.action] === PAYLOAD_ENCODING.DEEPSTREAM) {
      message.data = typed(JSON.parse(message.data.toString()))
    }

    return builder(message, isAck)
}

/**
 * Converts a serializable value into its string-representation and adds
 * a flag that provides instructions on how to deserialize it.
 *
 * Please see messageParser.convertTyped for the counterpart of this method
 */
export const typed = function (value: any): string {
  const type = typeof value

  if (type === 'string') {
    return TYPES.STRING + value
  }

  if (value === null) {
    return TYPES.NULL
  }

  if (type === 'object') {
    return TYPES.OBJECT + JSON.stringify(value)
  }

  if (type === 'number') {
    return TYPES.NUMBER + value.toString()
  }

  if (value === true) {
    return TYPES.TRUE
  }

  if (value === false) {
    return TYPES.FALSE
  }

  if (value === undefined) {
    return TYPES.UNDEFINED
  }

  throw new Error(`Can't serialize type ${value}`)
}
