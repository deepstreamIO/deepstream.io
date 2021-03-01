import {
  EVENT_ACTION,
  PRESENCE_ACTION,
  RECORD_ACTION,
  RPC_ACTION,
  TOPIC,
  Message,
  ALL_ACTIONS,
  ACTIONS
} from '../constants'

import * as Ajv from 'ajv'

import {
  getUid,
  reverseMap,
  deepFreeze,
} from '../utils/utils'
import { jifSchema } from './jif-schema'
import { JifMessage, DeepstreamServices, EVENT } from '@deepstream/types'

const ajv = new Ajv()

const validateJIF: any = ajv.compile(jifSchema)

type JifInMessage = any

// jif -> message lookup table
function getJifToMsg () {
  const JIF_TO_MSG: any = {}

  JIF_TO_MSG.event = {}
  JIF_TO_MSG.event.emit = (msg: JifInMessage) => ({
    done: true,
    message: {
      topic: TOPIC.EVENT,
      action: EVENT_ACTION.EMIT,
      name: msg.eventName,
      parsedData: msg.data,
    },
  })

  JIF_TO_MSG.rpc = {}
  JIF_TO_MSG.rpc.make = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RPC,
      action: RPC_ACTION.REQUEST,
      name: msg.rpcName,
      correlationId: getUid(),
      parsedData: msg.data,
    },
  })

  JIF_TO_MSG.record = {}
  JIF_TO_MSG.record.read = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.READ,
      name: msg.recordName,
    },
  })

  JIF_TO_MSG.record.write = (msg: JifInMessage) => (
    msg.path ? JIF_TO_MSG.record.patch(msg) : JIF_TO_MSG.record.update(msg)
  )

  JIF_TO_MSG.record.patch = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.CREATEANDPATCH,
      name: msg.recordName,
      version: msg.version || -1,
      path: msg.path,
      parsedData: msg.data,
      isWriteAck: true,
      correlationId: 0
    },
  })

  JIF_TO_MSG.record.update = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.CREATEANDUPDATE,
      name: msg.recordName,
      version: msg.version || -1,
      parsedData: msg.data,
      isWriteAck: true,
      correlationId: 0
    },
  })

  JIF_TO_MSG.record.head = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.HEAD,
      name: msg.recordName,
    },
  })

  JIF_TO_MSG.record.delete = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.DELETE,
      name: msg.recordName,
    },
  }),

  JIF_TO_MSG.record.notify = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.NOTIFY,
      names: msg.recordNames
    },
  })

  JIF_TO_MSG.list = {}
  JIF_TO_MSG.list.read = (msg: JifInMessage) => ({
      done: false,
      message: {
        topic: TOPIC.RECORD,
        action: RECORD_ACTION.READ,
        name: msg.listName,
      },
  })

  JIF_TO_MSG.list.write = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.CREATEANDUPDATE,
      name: msg.listName,
      version: msg.version || -1,
      parsedData: msg.data,
      isWriteAck: true,
      correlationId: 0
    },
  })

  JIF_TO_MSG.list.delete = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.DELETE,
      name: msg.listName,
    },
  })

  JIF_TO_MSG.presence = {}

  JIF_TO_MSG.presence.query = (msg: JifInMessage) => (
    msg.names ? JIF_TO_MSG.presence.queryUsers(msg) : JIF_TO_MSG.presence.queryAll(msg)
  )

  JIF_TO_MSG.presence.queryAll = () => ({
    done: false,
    message: {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTION.QUERY_ALL,
    },
  })

  JIF_TO_MSG.presence.queryUsers = (msg: JifInMessage) => ({
    done: false,
    message: {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTION.QUERY,
      names: msg.names,
    },
  })

  return deepFreeze(JIF_TO_MSG)
}

// message type enumeration
const TYPE = { ACK: 'A', NORMAL: 'N' }

function getMsgToJif () {
  // message -> jif lookup table
  const MSG_TO_JIF: any = {}
  MSG_TO_JIF[TOPIC.RPC] = {}
  MSG_TO_JIF[TOPIC.RPC][RPC_ACTION.RESPONSE] = {}
  MSG_TO_JIF[TOPIC.RPC][RPC_ACTION.RESPONSE][TYPE.NORMAL] = (message: Message) => ({
    done: true,
    message: {
      data: message.parsedData,
      success: true,
    },
  })

  MSG_TO_JIF[TOPIC.RPC][RPC_ACTION.REQUEST_ERROR] = {}
  MSG_TO_JIF[TOPIC.RPC][RPC_ACTION.REQUEST_ERROR][TYPE.NORMAL] = (message: Message) => ({
    done: true,
    message: {
      errorTopic: 'rpc',
      error: message.parsedData,
      success: false,
    },
  })

  MSG_TO_JIF[TOPIC.RPC][RPC_ACTION.ACCEPT] = {}
  MSG_TO_JIF[TOPIC.RPC][RPC_ACTION.ACCEPT][TYPE.NORMAL] = () => ({ done: false })

  MSG_TO_JIF[TOPIC.RPC][RPC_ACTION.REQUEST] = {}
  MSG_TO_JIF[TOPIC.RPC][RPC_ACTION.REQUEST][TYPE.ACK] = () => ({ done: false })

  MSG_TO_JIF[TOPIC.RECORD] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.READ_RESPONSE] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.READ_RESPONSE][TYPE.NORMAL] = (message: Message) => ({
    done: true,
    message: {
      version: message.version,
      data: message.parsedData,
      success: true,
    },
  })

  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.WRITE_ACKNOWLEDGEMENT] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.WRITE_ACKNOWLEDGEMENT][TYPE.NORMAL] = (message: Message) => ({
    done: true,
    message: {
      success: true,
    },
  })

  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.DELETE] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.DELETE][TYPE.NORMAL] = () => ({
    done: true,
    message: {
      success: true,
    },
  })

  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.DELETE_SUCCESS] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.DELETE_SUCCESS][TYPE.NORMAL] = () => ({
    done: true,
    message: {
      success: true,
    },
  })

  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.NOTIFY] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.NOTIFY][TYPE.ACK] = (message: Message) => ({
    done: true,
    message: {
      success: true,
    },
  })

  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.HEAD_RESPONSE] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTION.HEAD_RESPONSE][TYPE.NORMAL] = (message: Message) => ({
    done: true,
    message: {
      version: message.version,
      success: true,
    },
  })

  MSG_TO_JIF[TOPIC.PRESENCE] = {}
  MSG_TO_JIF[TOPIC.PRESENCE][PRESENCE_ACTION.QUERY_ALL_RESPONSE] = {}
  MSG_TO_JIF[TOPIC.PRESENCE][PRESENCE_ACTION.QUERY_ALL_RESPONSE][TYPE.NORMAL] = (message: Message) => ({
    done: true,
    message: {
      users: message.names,
      success: true,
    },
  })
  MSG_TO_JIF[TOPIC.PRESENCE][PRESENCE_ACTION.QUERY_RESPONSE] = {}
  MSG_TO_JIF[TOPIC.PRESENCE][PRESENCE_ACTION.QUERY_RESPONSE][TYPE.NORMAL] = (message: Message) => ({
    done: true,
    message: {
      users: message.parsedData,
      success: true,
    },
  })

  return deepFreeze(MSG_TO_JIF)
}

export default class JIFHandler {
  private JIF_TO_MSG = getJifToMsg()
  private MSG_TO_JIF = getMsgToJif()
  private topicToKey = reverseMap(TOPIC)

  constructor (private services: DeepstreamServices) {}

  /*
   * Validate and convert a JIF message to a deepstream message
   */
  public fromJIF (jifMessage: JifInMessage) {
    if (!validateJIF(jifMessage)) {
      let error = validateJIF.errors[0]
      switch (error.keyword) {
     // case 'additionalProperties':
     //   error = `property '${error.params.additionalProperty}'
     //   not permitted for topic '${jifMessage.topic}'`
     //   break
        case 'required':
          error = `property '${error.params.missingProperty}' is required for topic '${jifMessage.topic}'`
          break
        case 'type':
        case 'minLength':
          error = `property '${error.dataPath}' ${error.message}`
          break
     // case 'const':
     //   error = `value for property '${error.dataPath}' not valid for topic '${jifMessage.topic}'`
     //   break
        default:
          error = null
      }
      return {
        success: false,
        error,
        done: true,
      }
    }

    const result = this.JIF_TO_MSG[jifMessage.topic][jifMessage.action](jifMessage)
    result.success = true
    return result
  }

  /*
   * Convert a deepstream response/ack message to a JIF message response
   * @param {Object}  message     deepstream message
   *
   * @returns {Object} {
   *    {Object}  message   jif message
   *    {Boolean} done      false iff message should await another result/acknowledgement
   * }
   */
  public toJIF (message: Message): JifMessage {
    let type
    if (message.isAck) {
      type = TYPE.ACK
    } else {
      type = TYPE.NORMAL
    }

    if (message.isError) {
      return this.errorToJIF(message, message.action)
    }

    return this.MSG_TO_JIF[message.topic][message.action][type](message)
  }

  /*
   * Convert a deepstream error message to a JIF message response
   */
  public errorToJIF (message: Message, event: ALL_ACTIONS | string) {
    // convert topic enum to human-readable key
    const topicKey = this.topicToKey[message.topic]

    const result: any = {
      errorTopic: topicKey && topicKey.toLowerCase(),
      errorEvent: event,
      success: false,
    }

    if (event === ACTIONS[message.topic].MESSAGE_DENIED) {
      result.action = message.originalAction as number
      result.error = `Message denied. Action "${ACTIONS[message.topic][message.originalAction!]}" is not permitted.`
    } else if (message.topic === TOPIC.RECORD && event === RECORD_ACTION.VERSION_EXISTS) {
      result.error = `Record update failed. Version ${message.version} exists for record "${message.name}".`
      result.currentVersion = message.version
      result.currentData = message.parsedData
    } else if (message.topic === TOPIC.RECORD && event === RECORD_ACTION.INVALID_VERSION) {
      result.error = `Record update failed. Version ${message.version} is not valid for record "${message.name}".`
      result.currentVersion = message.version
      result.currentData = message.parsedData
    } else if (message.topic === TOPIC.RECORD && event === RECORD_ACTION.RECORD_NOT_FOUND) {
      result.error = `Record read failed. Record "${message.name}" could not be found.`
      result.errorEvent = message.action
    } else if (message.topic === TOPIC.RPC && event === RPC_ACTION.NO_RPC_PROVIDER) {
      result.error = `No provider was available to handle the RPC "${message.name}".`
      // message.correlationId = data[1]
    } else if (message.topic === TOPIC.RPC && message.action === RPC_ACTION.RESPONSE_TIMEOUT) {
      result.error = 'The RPC response timeout was exceeded by the provider.'
    } else {
      this.services.logger.warn(
        EVENT.INFO,
        `Unhandled request error occurred: ${TOPIC[message.topic]} ${event} ${JSON.stringify(message)}`,
        { message }
      )
      result.error = `An error occurred: ${RPC_ACTION[event as number]}.`
      result.errorParams = message.name
    }

    return {
      message: result,
      done: true,
    }
  }
}
