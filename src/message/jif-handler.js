'use strict'

const Ajv = require('ajv')

const jifSchema = require('./jif-schema')
const utils = require('../utils/utils')

const ajv = new Ajv()

const validateJIF = ajv.compile(jifSchema)

// jif -> message lookup table
function getJifToMsg (C, toTyped) {
  const JIF_TO_MSG = {}

  JIF_TO_MSG.event = {}
  JIF_TO_MSG.event.emit = msg => ({
    done: true,
    message: {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.EVENT,
      data: [msg.eventName, toTyped(msg.data)]
    }
  })


  JIF_TO_MSG.rpc = {}
  JIF_TO_MSG.rpc.make = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.REQUEST,
      data: [msg.rpcName, utils.getUid(), toTyped(msg.data)]
    }
  })

  JIF_TO_MSG.record = {}
  JIF_TO_MSG.record.read = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.SNAPSHOT,
      data: [msg.recordName]
    }
  })

  const enableWriteAcks = JSON.stringify({ writeSuccess: true })

  JIF_TO_MSG.record.write = msg => (
    msg.path ? JIF_TO_MSG.record.patch(msg) : JIF_TO_MSG.record.update(msg)
  )

  JIF_TO_MSG.record.patch = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.CREATEANDUPDATE,
      data: [
        msg.recordName,
        msg.version || -1,
        msg.path,
        toTyped(msg.data),
        msg.config || enableWriteAcks
      ]
    }
  })

  JIF_TO_MSG.record.update = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.CREATEANDUPDATE,
      data: [
        msg.recordName,
        msg.version || -1,
        JSON.stringify(msg.data),
        msg.config || enableWriteAcks
      ]
    }
  })

  JIF_TO_MSG.record.head = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.HEAD,
      data: [msg.recordName]
    }
  })

  JIF_TO_MSG.record.delete = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.DELETE,
      data: [msg.recordName]
    }
  })

  JIF_TO_MSG.list = {}
  JIF_TO_MSG.list.read = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.SNAPSHOT,
      data: [msg.listName]
    }
  })

  JIF_TO_MSG.list.write = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.CREATEANDUPDATE,
      data: [
        msg.listName,
        msg.version || -1,
        JSON.stringify(msg.data),
        enableWriteAcks
      ]
    }
  })

  JIF_TO_MSG.list.delete = msg => ({
    done: false,
    message: {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.DELETE,
      data: [msg.listName]
    }
  })

  JIF_TO_MSG.presence = {}
  JIF_TO_MSG.presence.query = () => ({
    done: false,
    message: {
      topic: C.TOPIC.PRESENCE,
      action: C.ACTIONS.QUERY,
      data: [C.ACTIONS.QUERY]
    }
  })

  return utils.deepFreeze(JIF_TO_MSG)
}

// message type enumeration
const TYPE = { ACK: 'A', NORMAL: 'N' }

function getMsgToJif (C, fromTyped) {
  // message -> jif lookup table
  const MSG_TO_JIF = {}
  MSG_TO_JIF[C.TOPIC.RPC] = {}
  MSG_TO_JIF[C.TOPIC.RPC][C.ACTIONS.RESPONSE] = {}
  MSG_TO_JIF[C.TOPIC.RPC][C.ACTIONS.RESPONSE][TYPE.NORMAL] = data => ({
    done: true,
    message: {
      data: fromTyped(data[2]),
      success: true
    }
  })

  MSG_TO_JIF[C.TOPIC.RPC][C.ACTIONS.REQUEST] = {}
  MSG_TO_JIF[C.TOPIC.RPC][C.ACTIONS.REQUEST][TYPE.ACK] = () => ({ done: false })

  MSG_TO_JIF[C.TOPIC.RECORD] = {}
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.READ] = {}
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.READ][TYPE.NORMAL] = data => ({
    done: true,
    message: {
      version: data[1],
      data: data[2],
      success: true
    }
  })

  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.WRITE_ACKNOWLEDGEMENT] = {}
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.WRITE_ACKNOWLEDGEMENT][TYPE.NORMAL] = data => ({
    done: true,
    message: {
      error: fromTyped(data[2]) || undefined,
      success: data[2] === 'L'
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
  MSG_TO_JIF[C.TOPIC.RECORD][C.ACTIONS.HEAD][TYPE.NORMAL] = data => ({
    done: true,
    message: {
      version: parseInt(data[1], 10),
      success: true
    }
  })

  MSG_TO_JIF[C.TOPIC.PRESENCE] = {}
  MSG_TO_JIF[C.TOPIC.PRESENCE][C.ACTIONS.QUERY] = {}
  MSG_TO_JIF[C.TOPIC.PRESENCE][C.ACTIONS.QUERY][TYPE.NORMAL] = data => ({
    done: true,
    message: {
      users: data,
      success: true
    }
  })

  return utils.deepFreeze(MSG_TO_JIF)
}

module.exports = class JIFHandler {

  constructor (options) {
    this._constants = options.constants
    this.JIF_TO_MSG = getJifToMsg(this._constants, options.toTyped)
    this.MSG_TO_JIF = getMsgToJif(this._constants, options.convertTyped)

    this._buildMessage = options.buildMessage

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
    const message = result.message

    result.message.raw = this._buildMessage(message.topic, message.action, message.data)

    result.success = true

    return result
  }

  /*
   * Convert a deepstream response/ack message to a JIF message response
   * @param {String}  topic     deepstream TOPIC
   * @param {String}  action    deepstream ACTION
   * @param {Array}   data      data array
   *
   * @returns {Object} {
   *    {Object}  message   jif message
   *    {Boolean} done      false iff message should await another result/acknowledgement
   * }
   */
  toJIF (topic, action, data) {
    let type
    let messageAction
    if (action === this._constants.ACTIONS.ACK) {
      type = TYPE.ACK
      messageAction = data[0]
    } else {
      type = TYPE.NORMAL
      messageAction = action
    }
    return this.MSG_TO_JIF[topic][messageAction][type](data)
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
  errorToJIF (topic, event, data) {
    // convert topic enum to human-readable key
    const topicKey = this.topicToKey[topic]
    const C = this._constants

    const message = {
      errorTopic: topicKey && topicKey.toLowerCase(),
      errorEvent: event,
      success: false
    }

    if (event === C.EVENT.MESSAGE_DENIED) {
      let action = this.actionToKey[data[1]]
      action = action && action.toLowerCase()
      message.action = action
      message.error = `Message denied. Action "${action}" is not permitted.`

    } else if (event === C.EVENT.VERSION_EXISTS) {
      message.error = `Record update failed. Version ${data[1]} exists for record "${data[0]}".`
      message.currentVersion = data[1]
      message.currentData = JSON.parse(data[2])

    } else if (data[1] === C.EVENT.RECORD_NOT_FOUND) {
      message.error = `Record read failed. Record "${data[0]}" could not be found.`
      message.errorEvent = data[1]

    } else if (event === C.EVENT.NO_RPC_PROVIDER) {
      message.error = `No provider was available to handle the RPC "${data[0]}".`
      // message.correlationId = data[1]

    } else if (topic === C.TOPIC.RPC && event === C.EVENT.RESPONSE_TIMEOUT) {
      message.error = 'The RPC response timeout was exceeded by the provider.'

    } else {
      this._logger.warn(
        `Unhandled request error occurred: ${topic} ${event} ${JSON.stringify(data)}`
      )
      message.error = `An error occurred: ${event}.`
      message.errorParams = data
    }

    return {
      message,
      done: true
    }
  }
}
