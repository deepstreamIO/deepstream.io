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
const actions = new Set(Object.keys(C.ACTIONS).map(key => C.ACTIONS[key]))

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
  static parse (message) {
    const parsedMessages = []
    const rawMessages = message.split(C.MESSAGE_SEPERATOR)

    for (let i = 0; i < rawMessages.length; i++) {
      if (rawMessages[i].length < 3) {
        continue
      }

      const parts = rawMessages[i].split(C.MESSAGE_PART_SEPERATOR)
      parsedMessages.push(parts.length < 2 || !actions.has(parts[1]) ? null : {
        raw: rawMessages[i],
        topic: parts[0],
        action: parts[1],
        data: parts.splice(2)
      })
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
  static convertTyped (value) {
    const type = value.charAt(0)

    if (type === C.TYPES.STRING) {
      return value.substr(1)
    }

    if (type === C.TYPES.OBJECT) {
      const result = utils.parseJSON(value.substr(1))
      if (result.value) {
        return result.value
      }
      return result.error
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
}
