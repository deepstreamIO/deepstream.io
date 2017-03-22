'use strict'

const C = require('../constants/constants')
const utils = require('../utils/utils')

/**
 * Turns the ACTION:SHORTCODE constants map
 * around to facilitate shortcode lookup
 *
 * @private
 *
 * @returns {Object} actions
*/
const actions = (function getActions() {
  const result = new Map()
  let key

  for (key in C.ACTIONS) {
    result.set(C.ACTIONS[key], key)
  }

  return result
}())

/**
 * Parses ASCII control character seperated
 * message strings into digestable maps
 *
 * @constructor
 */
module.exports = class MessageParser {

  /**
   * Main interface method. Receives a raw message
   * string, containing one or more messages
   * and returns an array of parsed message objects
   * or null for invalid messages
   *
   * @param   {String} message raw message
   *
   * @public
   *
   * @returns {Array} array of parsed message objects
   *                  following the format
   *                  {
   *                    raw: <original message string>
   *                    topic: <string>
   *                    action: <string - shortcode>
   *                    data: <array of strings>
   *                  }
   */
  static parse(message) {
    const parsedMessages = []

    let i = 2
    let k = 0
    while (i < message.length) {
      if (message[i] === C.MESSAGE_SEPERATOR) {
        parsedMessages.push(this.parseMessage(message.slice(k, i)))
        k = i + 1
        i = i + 3
      } else {
        i = i + 1
      }
    }

    if (i <= message.length) {
      parsedMessages.push(this.parseMessage(message.slice(k, i)))
    }

    return parsedMessages
  }

  /**
   * Deserializes values created by MessageBuilder.typed to
   * their original format
   *
   * @param {String} value
   *
   * @public
   * @returns {Mixed} original value
   */
  static convertTyped(value) {
    const type = value.charAt(0)

    if (type === C.TYPES.STRING) {
      return value.substr(1)
    }

    if (type === C.TYPES.OBJECT) {
      return utils.tryParseJson(value.substr(1))
    }

    if (type === C.TYPES.NUMBER) {
      return parseFloat(value.substr(1))
    }

    if (type === C.TYPES.NULL) {
      return null
    }

    if (type === C.TYPES.TRUE) {
      return true
    }

    if (type === C.TYPES.FALSE) {
      return false
    }

    if (type === C.TYPES.UNDEFINED) {
      return undefined
    }

    return new Error('Unknown type')
  }

  /**
   * Parses an individual message (as oposed to a
   * block of multiple messages as is processed by .parse())
   *
   * @param   {String} message
   *
   * @private
   *
   * @returns {Object} parsedMessage
   */
  static parseMessage(message) {
    const parts = message.split(C.MESSAGE_PART_SEPERATOR, 4)
    return !actions.has(parts[1]) ? null : {
      raw: message,
      topic: parts[0],
      action: parts[1],
      data: parts.splice(2)
    }
  }
}
