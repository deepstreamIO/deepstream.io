const C = require('../constants/constants')

const SEP = C.MESSAGE_PART_SEPERATOR

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
exports.getMsg = function (topic, action, data) {
  const sendData = [topic, action]

  if (data) {
    for (let i = 0; i < data.length; i++) {
      if (typeof data[i] === 'object') {
        sendData.push(JSON.stringify(data[i]))
      } else {
        sendData.push(data[i])
      }
    }
  }

  return sendData.join(SEP) + C.MESSAGE_SEPERATOR
}

exports.buildMsg3 = function (topic, action, p1) {
  return `${topic}${SEP}${action}${SEP}${p1}${C.MESSAGE_SEPERATOR}`
}

exports.buildMsg4 = function (topic, action, p1, p2) {
  return `${topic}${SEP}${action}${SEP}${p1}${SEP}${p2}${C.MESSAGE_SEPERATOR}`
}

exports.buildMsg5 = function (topic, action, p1, p2, p3) {
  return `${topic}${SEP}${action}${SEP}${p1}${SEP}${p2}${SEP}${p3}${C.MESSAGE_SEPERATOR}`
}

/**
 * Creates a deepstream error message string based on the provided
 * arguments
 *
 * @param   {String} topic   One of CONSTANTS.TOPIC - error messages might either be send on
 *                           the generic ERROR topic or on the topic that caused the error
 *
 * @param   {String} type    One of CONSTANTS.EVENT
 * @param   {String | Array } message a message text or an array of data
 *
 * @returns {String } deepstream error message string
 */
exports.getErrorMsg = function (topic, type, message) {
  if (message instanceof Array) {
    return `${topic + SEP}E${SEP}${type}${SEP}${message.join(SEP)}${C.MESSAGE_SEPERATOR}`
  }
  if (!topic) {
    return `${topic + SEP}E${SEP}${message.slice(2)}`
  }

  return `${topic + SEP}E${SEP}${type}${SEP}${message}${C.MESSAGE_SEPERATOR}`
}

/**
 * Converts a serializable value into its string-representation and adds
 * a flag that provides instructions on how to deserialize it.
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
