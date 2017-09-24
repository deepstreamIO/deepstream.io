'use strict'

const Ajv = require('ajv')

const jifSchema = require('./jif-schema')
const utils = require('../utils/utils')

const ajv = new Ajv()

const validateJIF = ajv.compile(jifSchema)

// jif -> message lookup table
function getJifToMsg (C) {
  const JIF_TO_MSG = {}

  JIF_TO_MSG.event = {}
  JIF_TO_MSG.event.emit = msg => ({
    done: true,
    message: {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      name: msg.eventName,
      parsedData: msg.data
    }
  })


  JIF_TO_MSG.rpc = {}
  JIF_TO_MSG.rpc.make = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      name: msg.rpcName,
      correlationId: utils.getUid(),
      parsedData: msg.data
    }
  })

  JIF_TO_MSG.record = {}
  JIF_TO_MSG.record.read = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.SNAPSHOT,
      name: msg.recordName
    }
  })

  JIF_TO_MSG.record.write = msg => (
    msg.path ? JIF_TO_MSG.record.patch(msg) : JIF_TO_MSG.record.update(msg)
  )

  JIF_TO_MSG.record.patch = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.CREATEANDUPDATE,
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
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.CREATEANDUPDATE,
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
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.HEAD,
      name: msg.recordName
    }
  })

  JIF_TO_MSG.record.delete = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.DELETE,
      name: msg.recordName
    }
  })

  JIF_TO_MSG.presence = {}
  JIF_TO_MSG.presence.query = () => ({
    done: false,
    message: {
      topic: C.TOPIC.PRESENCE,
      action: C.ACTIONS.QUERY,
      name: C.ACTIONS.QUERY, // required by permissions
      parsedData: C.ACTIONS.QUERY
    }
  })

  return utils.deepFreeze(JIF_TO_MSG)
}

// message type enumeration
const TYPE = { ACK: 'A', NORMAL: 'N' }

function getMsgToJif (C) {
  // message -> jif lookup table
  const MSG_TO_JIF = {}
  MSG_TO_JIF[C.TOPIC.RPC] = {}
  MSG_TO_JIF[C.TOPIC.RPC][C.ACTIONS.RESPONSE] = {}
  MSG_TO_JIF[C.TOPIC.RPC][C.ACTIONS.RESPONSE][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      data: message.parsedData,
      success: true
    }
  })

  MSG_TO_JIF[C.TOPIC.RPC][C.ACTIONS.REQUEST] = {}
  MSG_TO_JIF[C.TOPIC.RPC][C.ACTIONS.REQUEST][TYPE.ACK] = () => ({ done: false })

  MSG_TO_JIF[C.TOPIC.RECORD] = {}
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.READ] = {}
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.READ][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      version: message.version,
      data: message.parsedData,
      success: true
    }
  })

  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.WRITE_ACKNOWLEDGEMENT] = {}
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.WRITE_ACKNOWLEDGEMENT][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      error: message.data[1] || undefined,
      success: message.data[1] === null
    }
  })

  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.DELETE] = {}
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.DELETE][TYPE.ACK] = () => ({
    done: true,
    message: {
      success: true
    }
  })
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.HEAD] = {}
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.HEAD][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      version: message.version,
      success: true
    }
  })

  MSG_TO_JIF[C.TOPIC.PRESENCE] = {}
  MSG_TO_JIF[C.TOPIC.PRESENCE][C.ACTIONS.QUERY] = {}
  MSG_TO_JIF[C.TOPIC.PRESENCE][C.ACTIONS.QUERY][TYPE.NORMAL] = message => ({
    done: true,
    message: {
      users: message.parsedData,
      success: true
    }
  })

  return utils.deepFreeze(MSG_TO_JIF)
}

module.exports = class JIFHandler {

  constructor (options) {
    this._constants = options.constants
    this.JIF_TO_MSG = getJifToMsg(this._constants)
    this.MSG_TO_JIF = getMsgToJif(this._constants)

    this.topicToKey = utils.reverseMap(this._constants.TOPIC)
    this.actionToKey = utils.reverseMap(this._constants.ACTIONS)

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
    const C = this._constants

    const result = {
      errorTopic: topicKey && topicKey.toLowerCase(),
      errorEvent: event,
      success: false
    }

    if (event === C.EVENT.MESSAGE_DENIED) {
      let action = this.actionToKey[message.action]
      action = action && action.toLowerCase()
      result.action = action
      result.error = `Message denied. Action "${action}" is not permitted.`

    } else if (event === C.EVENT.VERSION_EXISTS) {
      result.error = `Record update failed. Version ${message.version} exists for record "${message.name}".`
      result.currentVersion = message.version
      result.currentData = message.parsedData
    } else if (event === C.EVENT.RECORD_NOT_FOUND) {
      result.error = `Record read failed. Record "${message.name}" could not be found.`
      result.errorEvent = message.event
    } else if (event === C.EVENT.NO_RPC_PROVIDER) {
      result.error = `No provider was available to handle the RPC "${message.name}".`
      // message.correlationId = data[1]
    } else if (message.topic === C.TOPIC.RPC && event === C.EVENT.RESPONSE_TIMEOUT) {
      result.error = 'The RPC response timeout was exceeded by the provider.'

    } else {
      this._logger.warn(
        `Unhandled request error occurred: ${message.topic} ${event} ${JSON.stringify(message.parsedData)}`
      )
      result.error = `An error occurred: ${event}.`
      result.errorParams = message.data
    }

    return {
      message: result,
      done: true
    }
  }
}
