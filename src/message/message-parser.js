'use strict'

const C = require('../constants/constants')

/**
 * Turns the ACTION:SHORTCODE constants map
 * around to facilitate shortcode lookup
 *
 * @private
 *
 * @returns {Object} actions
*/
const actions = (function getActions() {
  const result = {}
  let key

  for (key in C.ACTIONS) {
    result[C.ACTIONS[key]] = key
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
    const rawMessages = message.split(C.MESSAGE_SEPERATOR)

    for (let i = 0; i < rawMessages.length; i++) {
      if (rawMessages[i].length > 2) {
        parsedMessages.push(this.parseMessage(rawMessages[i]))
      }
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
      try {
        return JSON.parse(value.substr(1))
      } catch (e) {
        return e
      }
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
    const parts = message.split(C.MESSAGE_PART_SEPERATOR)
    const messageObject = {}

    if (parts.length < 2) {
      return null
    }

    if (actions[parts[1]] === undefined) {
      return null
    }

    messageObject.raw = message
    messageObject.topic = parts[0]
    messageObject.action = parts[1]
    messageObject.data = parts.splice(2)

    return messageObject
  }
}
