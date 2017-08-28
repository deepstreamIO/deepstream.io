const MC = require('./message-constants')
const C = require('../../constants/constants')

const MAX_PAYLOAD_LENGTH = Math.pow(2, 24)
const HEADER_LENGTH = 6

function preprocessMsg (topic, action, data) {
  const topicByte = MC.TOPIC_TEXT_TO_BYTE[topic]
  let processedAction = action
  let processedData = data
  if (
    action === C.ACTIONS.ACK &&
    topicByte !== MC.TOPIC_BYTES.EVENT_LISTENING &&
    topicByte !== MC.TOPIC_BYTES.RECORD_LISTENING &&
    topicByte !== MC.TOPIC_BYTES.CONNECTION &&
    topicByte !== MC.TOPIC_BYTES.AUTH
  ) {
    processedAction = `${data[0]}_A`
    processedData = data.slice(1)
  }
  const topicKey = MC.TOPIC_TEXT_TO_KEY[topic]
  const actionByte = MC.ACTIONS_TEXT_TO_BYTE[topicKey][processedAction]

  return { topicByte, actionByte, data: processedData }
}

function postprocessMsg (message) {
  const topic = MC.TOPIC_BYTE_TO_TEXT[message.topicByte]
  const topicKey = MC.TOPIC_BYTE_TO_KEY[message.topicByte]
  let action = MC.ACTIONS_BYTE_TO_TEXT[topicKey][message.actionByte]
  const data = message.body
  if (action.endsWith('_A')) {
    data.unshift(action.slice(0, -2))
    action = C.ACTIONS.ACK
  }
  return { topic, action, data }
}

function getBinaryMsg (topicByte, actionByte, data) {
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
    throw new Error(`tried to parse ${typeof buff}`)
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

module.exports = { preprocessMsg, postprocessMsg, getBinaryMsg, tryParseBinaryMsg }
