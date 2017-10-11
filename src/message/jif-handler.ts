import { RECORD_ACTIONS, EVENT_ACTIONS, RPC_ACTIONS, EVENT, PRESENCE_ACTIONS, TOPIC } from '../constants'

import * as Ajv from 'ajv'

import jifSchema from './jif-schema'
import * as utils from '../utils/utils'

const ajv = new Ajv()

const validateJIF: any = ajv.compile(jifSchema)

// jif -> message lookup table
function getJifToMsg () {
  const JIF_TO_MSG: any = {}

  JIF_TO_MSG.event = {}
  JIF_TO_MSG.event.emit = msg => ({
    done: true,
    message: {
      topic: TOPIC.EVENT,
      action: EVENT_ACTIONS.EMIT,
      name: msg.eventName,
      parsedData: msg.data
    }
  })


  JIF_TO_MSG.rpc = {}
  JIF_TO_MSG.rpc.make = msg => ({
    done: false,
    message: {
      topic: TOPIC.RPC,
      action: RPC_ACTIONS.REQUEST,
      name: msg.rpcName,
      correlationId: utils.getUid(),
      parsedData: msg.data
    }
  })

  JIF_TO_MSG.record = {}
  JIF_TO_MSG.record.read = msg => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTIONS.READ,
      name: msg.recordName
    }
  })

  JIF_TO_MSG.record.write = msg => (
    msg.path ? JIF_TO_MSG.record.patch(msg) : JIF_TO_MSG.record.update(msg)
  )

  JIF_TO_MSG.record.patch = msg => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTIONS.CREATEANDUPDATE,
      name: msg.recordName,
      version: msg.version || -1,
      path: msg.path,
      parsedData: msg.data,
      isWriteAck: true
    }
  })

  JIF_TO_MSG.record.update = msg => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTIONS.CREATEANDUPDATE,
      name: msg.recordName,
      version: msg.version || -1,
      path: null,
      parsedData: msg.data,
      isWriteAck: true
    }
  })

  JIF_TO_MSG.record.head = msg => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTIONS.HEAD,
      name: msg.recordName
    }
  })

  JIF_TO_MSG.record.delete = msg => ({
    done: false,
    message: {
      topic: TOPIC.RECORD,
      action: RECORD_ACTIONS.DELETE,
      name: msg.recordName
    }
  })

  JIF_TO_MSG.presence = {}

  JIF_TO_MSG.presence.query = msg => (
    msg.parsedData ? JIF_TO_MSG.presence.queryUsers(msg) : JIF_TO_MSG.presence.queryAll(msg)
  )

  JIF_TO_MSG.presence.queryAll = () => ({
    done: false,
    message: {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTIONS.QUERY_ALL,
      name: PRESENCE_ACTIONS.QUERY_ALL
    }
  })

  JIF_TO_MSG.presence.queryUsers = msg => ({
    done: false,
    message: {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTIONS.QUERY,
      name: PRESENCE_ACTIONS.QUERY,
      parsedData: msg.data
    }
  })

  return utils.deepFreeze(JIF_TO_MSG)
}

// message type enumeration
const TYPE = { ACK: 'A', NORMAL: 'N' }

function getMsgToJif () {
  // message -> jif lookup table
  const MSG_TO_JIF = {}
  MSG_TO_JIF[TOPIC.RPC] = {}
  MSG_TO_JIF[TOPIC.RPC][RPC_ACTIONS.RESPONSE] = {}
  MSG_TO_JIF[TOPIC.RPC][RPC_ACTIONS.RESPONSE][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      data: message.parsedData,
      success: true
    }
  })

  MSG_TO_JIF[TOPIC.RPC][RPC_ACTIONS.REQUEST] = {}
  MSG_TO_JIF[TOPIC.RPC][RPC_ACTIONS.REQUEST][TYPE.ACK] = () => ({ done: false })

  MSG_TO_JIF[TOPIC.RECORD] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTIONS.READ] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTIONS.READ][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      version: message.version,
      data: message.parsedData,
      success: true
    }
  })

  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      error: message.data[1] || undefined,
      success: message.data[1] === null
    }
  })

  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTIONS.DELETE] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTIONS.DELETE][TYPE.ACK] = () => ({
    done: true,
    message: {
      success: true
    }
  })
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTIONS.HEAD] = {}
  MSG_TO_JIF[TOPIC.RECORD][RECORD_ACTIONS.HEAD][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      version: message.version,
      success: true
    }
  })

  MSG_TO_JIF[TOPIC.PRESENCE] = {}
  MSG_TO_JIF[TOPIC.PRESENCE][PRESENCE_ACTIONS.QUERY] = {}
  MSG_TO_JIF[TOPIC.PRESENCE][PRESENCE_ACTIONS.QUERY][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      users: message.parsedData,
      success: true
    }
  })

  return utils.deepFreeze(MSG_TO_JIF)
}

export default class JIFHandler {
  private JIF_TO_MSG: any
  private MSG_TO_JIF: any
  private topicToKey: any
  private _logger: Logger

  constructor (options) {
    this.JIF_TO_MSG = getJifToMsg()
    this.MSG_TO_JIF = getMsgToJif()

    this.topicToKey = utils.reverseMap(TOPIC)

    this._logger = options.logger
  }

  /*
   * Validate and convert a JIF message to a deepstream message
   * @param {Object} jifMessage    JIF message
   *
   * @returns {Object} {
   *    {Boolean} success   true if the message passed validation
   *    {String}  error     if (!success), a description of the error that occurred
   *    {Object}  message   if (success) the deepstream message generated
   *    {Boolean} done      false iff message should await a result/acknowledgement
   * }
   */
  fromJIF (jifMessage) {
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
        done: true
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
  toJIF (message) {
    let type
    if (message.isAck) {
      type = TYPE.ACK
    } else {
      type = TYPE.NORMAL
    }
    return this.MSG_TO_JIF[message.topic][message.action][type](message)
  }

  /*
   * Convert a deepstream error message to a JIF message response
   * @param {String}        topic     deepstream TOPIC
   * @param {String}        event     deepstream EVENT
   * @param {Array|String}  data   error message or data array
   *
   * @returns {Object} {
   *    {Object}  message   jif message
   *    {Boolean} done      false iff message should await another result/acknowledgement
   * }
   */
  errorToJIF (message, event) {
    // convert topic enum to human-readable key
    const topicKey = this.topicToKey[message.topic]

    const result: any = {
      errorTopic: topicKey && topicKey.toLowerCase(),
      errorEvent: event,
      success: false
    }

    if (event === EVENT.MESSAGE_DENIED) {
      let action = message.action.toString().toLowerCase()
      result.action = action
      result.error = `Message denied. Action "${action}" is not permitted.`

    } else if (event === EVENT.VERSION_EXISTS) {
      result.error = `Record update failed. Version ${message.version} exists for record "${message.name}".`
      result.currentVersion = message.version
      result.currentData = message.parsedData
    } else if (event === EVENT.RECORD_NOT_FOUND) {
      result.error = `Record read failed. Record "${message.name}" could not be found.`
      result.errorEvent = message.event
    } else if (event === EVENT.NO_RPC_PROVIDER) {
      result.error = `No provider was available to handle the RPC "${message.name}".`
      // message.correlationId = data[1]
    } else if (message.topic === TOPIC.RPC && event === EVENT.RESPONSE_TIMEOUT) {
      result.error = 'The RPC response timeout was exceeded by the provider.'

    } else {
      this._logger.warn(
        EVENT.INFO,
        `Unhandled request error occurred: ${TOPIC[message.topic]} ${EVENT[event]} ${JSON.stringify(message)}`
      )
      result.error = `An error occurred: ${EVENT[event]}.`
      result.errorParams = message.name
    }

    return {
      message: result,
      done: true
    }
  }
}
