'use strict'

const C = require('../constants/constants')

const SEP = C.MESSAGE_PART_SEPERATOR

const writeConfig = JSON.stringify({ writeSuccess: true })

/**
 * Creates a deepstream message string, based on the
 * provided parameters
 *
 * @param   {String} topic  One of CONSTANTS.TOPIC
 * @param   {String} action One of CONSTANTS.ACTIONS
 * @param   {Array} data An array of strings or JSON-serializable objects
 *
 * @returns {String} deepstream message string
 */
exports.getMessage = function (message, isAck) {
  let sendData
  if (message.isAck || isAck) {
    sendData = [message.topic, C.ACTIONS.ACK]
  } else {
    sendData = [message.topic]
  }
  if (message.event) {
    sendData.push(message.data)
  }
  if (message.message) {
    sendData.push(message.message)
  }
  if (message.action) {
    sendData.push(message.action)
  }
  if (message.name) {
    sendData.push(message.name)
  }
  if (typeof message.version !== 'undefined' && message.version !== null) {
    sendData.push(message.version)
  }
  if (typeof message.path !== 'undefined' && message.path !== null) {
    sendData.push(message.path)
  }
  if (message.subscription) {
    sendData.push(message.subscription)
  }
  if (message.correlationId) {
    sendData.push(message.correlationId)
  }

  if (message.action === C.ACTIONS.WRITE_ACKNOWLEDGEMENT) {
    sendData.push(JSON.stringify(message.data[0]))
    sendData.push(exports.typed(message.data[1]))
  } else if (message.data) {
    for (let i = 0; i < message.data.length; i++) {
      if (typeof message.data[i] === 'object') {
        sendData.push(JSON.stringify(message.data[i]))
      } else {
        sendData.push(message.data[i])
      }
    }
  }

  // only occurs on merge conflicts
  if (message.isWriteAck) {
    sendData.push(writeConfig)
  }

  return sendData.join(SEP) + C.MESSAGE_SEPERATOR
}

/**
 * Creates a deepstream error message string based on the provided
 * arguments
 *
 * @param   {Message} message a message text or an array of data
 * @returns {String } deepstream error message string
 */
exports.getErrorMessage = function (message, event, errorMessage) {
  let sendData = [message.topic, C.ACTIONS.ERROR, event]
  if (event === C.EVENT.RECORD_NOT_FOUND) {
    sendData = [message.topic, C.ACTIONS.ERROR, message.action, message.name, event]
  } else if (event === C.EVENT.NO_RPC_PROVIDER || event === C.EVENT.RESPONSE_TIMEOUT) {
    sendData = [message.topic, C.ACTIONS.ERROR, event, message.name, message.correlationId]
  } else if (
    event === C.EVENT.MESSAGE_DENIED &&
    message.topic === C.TOPIC.RPC &&
    message.action === C.ACTIONS.REQUEST
  ) {
    sendData = [message.topic, C.ACTIONS.ERROR, event, message.name, message.correlationId]
  } else if (!errorMessage) {
    if (message.name) {
      sendData.push(message.name)
    }
    if (message.action) {
      sendData.push(message.action)
    }
    if (message.name) {
      sendData.push(message.name)
    }
    if (message.correlationId) {
      sendData.push(message.correlationId)
    }
    if (message.data) {
      for (let i = 0; i < message.data.length; i++) {
        if (typeof message.data[i] === 'object') {
          sendData.push(JSON.stringify(message.data[i]))
        } else {
          sendData.push(message.data[i])
        }
      }
    }
  } else {
    sendData.push(errorMessage)
  }

  return sendData.join(SEP) + C.MESSAGE_SEPERATOR
}

/**
 * Converts a serializable value into its string-representation and adds
 * a flag that provides instructions on how to deserialize it.
 *
 * Please see messageParser.convertTyped for the counterpart of this method
 *
 * @param {Mixed} value
 *
 * @public
 * @returns {String} string representation of the value
 */
exports.typed = function (value) {
  const type = typeof value

  if (type === 'string') {
    return C.TYPES.STRING + value
  }

  if (value === null) {
    return C.TYPES.NULL
  }

  if (type === 'object') {
    return C.TYPES.OBJECT + JSON.stringify(value)
  }

  if (type === 'number') {
    return C.TYPES.NUMBER + value.toString()
  }

  if (value === true) {
    return C.TYPES.TRUE
  }

  if (value === false) {
    return C.TYPES.FALSE
  }

  if (value === undefined) {
    return C.TYPES.UNDEFINED
  }

  throw new Error(`Can't serialize type ${value}`)
}
