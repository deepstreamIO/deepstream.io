const MC = require('./message-constants')

const MAX_PAYLOAD_LENGTH = Math.pow(2, 24)
const HEADER_LENGTH = 6

function getBinaryMsg (topic, action, data) {
  const topicByte = typeof topic === 'number' ? topic : MC.TOPIC_TEXT_TO_BYTE[topic]
  const actionByte = typeof action === 'number' ? action : MC.ACTIONS.CLUSTER_TEXT_TO_BYTE[action]
  const optionByte = 0x00
  let payload
  let payloadLength = 0
  if (data) {
    payload = Buffer.from(JSON.stringify(data))
    payloadLength = payload.length
  }
  if (payloadLength > MAX_PAYLOAD_LENGTH) {
    throw new Error(`Data payload too long: ${payload.length} cannot be encoded in 24 bits`)
  }
  // Message: | T | A | O | L | L | L | payload...
  const buff = Buffer.allocUnsafe(HEADER_LENGTH + payloadLength)
  buff.writeUInt8(topicByte, 0)
  buff.writeUInt8(actionByte, 1)
  buff.writeUInt8(optionByte, 2)
  buff.writeUIntBE(payloadLength, 3, 3)
  if (payloadLength > 0) payload.copy(buff, HEADER_LENGTH)
  return buff
}

function tryParseBinaryMsg (buff, onBodyParseError) {
  if (!(buff instanceof Buffer)) {
    throw new Error('tried to parse non-buffer' + typeof buff)
  }
  // parse header
  if (buff.length < HEADER_LENGTH) {
    return { bytesConsumed: 0 }
  }
  const message = {}
  message.topicByte = buff.readUInt8(0)
  message.actionByte = buff.readUInt8(1)
  message.optionByte = buff.readUInt8(2)
  const payloadLength = message.payloadLength = buff.readUIntBE(3, 3)
  const messageLength = HEADER_LENGTH + payloadLength

  // parse payload
  if (payloadLength === 0) {
    return { message, bytesConsumed: messageLength }
  }
  if (payloadLength > MAX_PAYLOAD_LENGTH) {
    onBodyParseError('payload length limit exceeded', message)
    return { bytesConsumed: messageLength }
  }
  if (buff.length < messageLength) {
    return { bytesConsumed: 0 }
  }
  const payload = buff.slice(HEADER_LENGTH, messageLength)
  try {
    message.body = JSON.parse(payload)
  } catch (err) {
    onBodyParseError(`malformed json body: '${payload.toString()}'`, message)
  }
  return { message, bytesConsumed: messageLength }
}

module.exports = { getBinaryMsg, tryParseBinaryMsg }
