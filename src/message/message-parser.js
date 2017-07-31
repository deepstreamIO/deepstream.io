'use strict'

const C = require('../constants/constants')

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
    let result

    if (!callback) {
      result = []
      callback = (msg) => {
        result.push(msg)
      }
    }

    for (let i = 0; i < rawMessages.length; i++) {
      if (rawMessages[i].length < 3) {
        continue
      }
      const parts = rawMessages[i].split(C.MESSAGE_PART_SEPERATOR)
      callback(parts.length < 2 ? null : {
        raw: rawMessages[i],
        topic: parts[0],
        action: parts[1],
        data: parts.splice(2)
      }, message)
    }

    return result
  }
}
