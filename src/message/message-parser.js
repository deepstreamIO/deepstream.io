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
  static parse (message, callback) {
    const rawMessages = message.split(C.MESSAGE_SEPERATOR)

    for (let i = 0; i < rawMessages.length; i++) {
      if (rawMessages[i].length > 2) {
        callback(this.parseMessage(rawMessages[i]), message)
      }
    }
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
  static parseMessage (message) {
    const parts = message.split(C.MESSAGE_PART_SEPERATOR)

    if (parts.length < 2) {
      return null
    }

    if (!actions.has(parts[1])) {
      return null
    }

    return {
      raw: message,
      topic: parts[0],
      action: parts[1],
      data: parts.splice(2)
    }
  }
}
