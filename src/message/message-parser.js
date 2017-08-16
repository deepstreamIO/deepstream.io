const C = require('../constants/constants')

module.exports = class MessageParser {
  static parse (rawMessage, result) {
    if (rawMessage.length < 3) {
      return
    }

    const parts = rawMessage.split(C.MESSAGE_PART_SEPERATOR)

    if (parts.length < 2) {
      return null
    }

    result = result || Object.create(null)
    result.raw = rawMessage
    result.topic = parts[0]
    result.action = parts[1]
    result.data = parts.splice(2)

    return result
  }
}
