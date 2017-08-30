/**
 * Functions for handling (de)serialization of the deepstream binary realtime protocol.
 *
 * In brief, a message is a variable length binary blob with the following structure:
 *
 *  0                   1                   2                   3
 *  0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
 * +---------------+---------------+-----+-+-+-+-+-+---------------+
 * |    Message    |    Message    |Payl.|C|R|R|R|R|               |
 * |     Topic     |    Action     |Enc- |O|S|S|S|S|    Payload    |
 * |      (8)      |     (8)       |oding|N|V|V|V|V|   Length (24) |
 * |               |               |(3)  |T|0|1|2|3|               |
 * +---------------+---------------+-----+-+-+-+-+-+---------------+
 * | Payload Length (continued)... |      Payload Data             |
 * +-------------------------------+ - - - - - - - - - - - - - - - +
 * :                     Payload Data continued ...                :
 * + - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - +
 * |                     Payload Data continued ...                |
 * +---------------------------------------------------------------+
 *
 * The first 6 bytes of the message are the header, and the rest of the message is the payload.
 *
 * Payload Encoding (3 bits): A 3-bit enumeration of encoding of the payload
 *                00      - utf-8/json
 *                01      - utf-8/json + gzip
 *                02      - msg-pack
 *                03...07 - unassigned
 * CONT (1 bit): The continuation bit. If this is set, the following payload of the following
 *                message must be appended to this one. If this is not set, parsing may finish
 *                after the payload is read.
 * RSV{0..3} (1 bit): Reserved for extension.
 * Payload Length (24 bits): The total length of the payload in bytes.
 *                If the payload is longer than 16 MB, it must be split into chunks of
 *                less than 2^24 bytes with identical topic and action, setting the CONT bit
 *                in all but the final chunk.
 *
 */

'use strict'

const MC = require('./message-constants')
const C = require('../../constants/constants')

const MAX_PAYLOAD_LENGTH = Math.pow(2, 24) - 1
const HEADER_LENGTH = 6

/*
 * Convert deepstream topic and action constants into their corresponding binary encoding
 * The binary action format is encoded based on the topic, so ensure the topic and action are
 * defined properly in the constants file.
 * Message acknowledgements where the action is normally embedded in the data become unique
 * actions.
 *
 * e.g. preprocessMsg('R', 'A', ['S', 'foobar'])
 *    =>>>
 *  {
 *    topicByte: MC.TOPIC_BYTES.RECORD,
 *    actionByte: MC.ACTION_BYTES.RECORD.SUBSCRIBE_ACK,
 *    data: ['foobar']
 *  }
 * @param topic  {String} deepstream topic e.g. 'R'
 * @param action {String} deepstream action e.g. 'US'
 * @param data   {Object|Array} data
 *
 * @returns {
 *   topicByte  {Integer}
 *   actionByte {Integer}
 *   data       {Object}
 * }
 */
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

/*
 * Convert deepstream binary enums back to the standard deepstream internal message format
 *
 * @param message {
 *  topicByte  {Integer}
 *  actionByte {Integer}
 *  body       {Object}
 * }
 *
 * @returns {
 *   topic  {String}
 *   action {String}
 *   data   {Object}
 * }
 */
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

/*
 * Serialize a binary message
 * If a payload is provided it will be serialized as JSON
 *
 * @returns {Buffer} the serialized data buffer
 *
 * @throws when length of serialized data is greater than MAX_PAYLOAD_LENGTH
 * @throws if the data object contains circular references
 */
function getBinaryMsg (topicByte, actionByte, data) {
  const optionByte = 0x00
  let payload
  let payloadLength = 0
  if (data instanceof Buffer) {
    payload = data
    payloadLength = data.length
  } else if (data !== undefined) {
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

/*
 * Deserialize a binary message
 */
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
    return { bytesConsumed: messageLength }
  }
  return { message, bytesConsumed: messageLength }
}

module.exports = { preprocessMsg, postprocessMsg, getBinaryMsg, tryParseBinaryMsg }
