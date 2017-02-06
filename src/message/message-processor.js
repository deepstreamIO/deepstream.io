const messageParser = require('./message-parser')
const C = require('../constants/constants')

const Queue = function (parent, socketWrapper) {
  this.onAuthenticatedMessage = parent.onAuthenticatedMessage
  this.permissionHandler = parent._options.permissionHandler
  this.logger = parent._options.logger
  this.socketWrapper = socketWrapper
  this.messages = []
  this.running = false
  this.start = 0
  this.end = 0
  this.counter = 0

  this._next = this._next.bind(this)
}

Queue.prototype.process = function (message) {
  for (const parsedMessage of messageParser.parse(message)) {
    if (parsedMessage === null) {
      this.logger.log(C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PARSE_ERROR, message)
      this.socketWrapper.sendError(C.TOPIC.ERROR, C.EVENT.MESSAGE_PARSE_ERROR, message)
      continue
    }

    if (parsedMessage.topic === C.TOPIC.CONNECTION && parsedMessage.action === C.ACTIONS.PONG) {
      continue
    }

    this.messages[this.end] = parsedMessage
    this.end += 1
  }

  this._next()
}

Queue.prototype._next = function () {
  if (this.running) {
    return
  }

  if (this.end === this.start) {
    this.start = 0
    this.end = 0
    return
  }

  // Avoid stack overflow from synchronous callbacks
  if (this.counter > 128) {
    this.counter = 0
    return process.nextTick(this._next)
  }

  this.running = true
  this.counter += 1
  this.permissionHandler.canPerformAction(
    this.socketWrapper.user,
    this.messages[this.start],
    (error, result) => {
      this.running = false

      const parsedMessage = this.messages[this.start]
      this.messages[this.start] = undefined
      this.start += 1

      if (error) {
        this.logger.log(C.LOG_LEVEL.WARN, C.EVENT.MESSAGE_PERMISSION_ERROR, error.toString())
        this.socketWrapper.sendError(parsedMessage.topic, C.EVENT.MESSAGE_PERMISSION_ERROR, getPermissionErrorData(parsedMessage))
      } else if (!result) {
        this.socketWrapper.sendError(parsedMessage.topic, C.EVENT.MESSAGE_DENIED, getPermissionErrorData(parsedMessage))
      }

      if (!error && result) {
        this.onAuthenticatedMessage(this.socketWrapper, parsedMessage)
      }

      this._next()
    },
    this.socketWrapper.authData
  )
  this.counter -= 1
}

/**
 * The MessageProcessor consumes blocks of parsed messages emitted by the
 * ConnectionEndpoint, checks if they are permissioned and - if they
 * are - forwards them.
 *
 * @constructor
 *
 * @param {Object} options deepstream options
 */
const MessageProcessor = function (options) {
  this._options = options
  this._queues = new Map()
}

/**
 * There will only ever be one consumer of forwarded messages. So rather than using
 * events - and their performance overhead - the messageProcessor exposes
 * this method that's expected to be overwritten.
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message the parsed message
 *
 * @overwrite
 *
 * @returns {void}
 */
MessageProcessor.prototype.onAuthenticatedMessage = function (socketWrapper, message) {}

/**
 * This method is the way the message processor accepts input. It receives arrays
 * of parsed messages, iterates through them and issues permission requests for
 * each individual message
 *
 * @todo The responses from the permissionHandler might arive in any arbitrary order - order them
 * @todo Handle permission handler timeouts
 *
 * @param   {SocketWrapper} socketWrapper
 * @param   {Object} message parsed message
 *
 * @returns {void}
 */
MessageProcessor.prototype.process = function (socketWrapper, message) {
  let queue = this._queues.get(socketWrapper)
  if (!queue) {
    queue = new Queue(this, socketWrapper)
    this._queues.set(socketWrapper, queue)
    socketWrapper.on('close', () => this._queues.delete(socketWrapper))
  }
  queue.process(message)
}

/**
 * Create data in the correct format expected in a MESSAGE_DENIED or MESSAGE_PERMISSION_ERROR
 *
 * @param   {Object} message  parsed message - might have been manipulated
 *                              by the permissionHandler
 * @returns {Object}
 */
function getPermissionErrorData (message) {
  let data = [ message.data[0], message.action ]
  if (message.data.length > 1) {
    data = data.concat(message.data.slice(1))
  }
  return data
}

module.exports = MessageProcessor
