const MessageQueue = require('./message-queue')
const C = require('../constants/constants')

const QUEUE_SYMBOL = Symbol('queue')

module.exports = class MessageProcessor {
  constructor (options) {
    this._options = options
  }

  onAuthenticatedMessage (socketWrapper, message) {
  }

  process (socketWrapper, message) {
    if (typeof message !== 'string') {
      this._options.logger.log(
        C.LOG_LEVEL.WARN,
        C.EVENT.INVALID_MESSAGE,
        'non text based message recieved'
      )
      socketWrapper.sendError(
        C.TOPIC.ERROR,
        C.EVENT.MESSAGE_PARSE_ERROR,
       'non text based message recieved'
      )
      return
    }

    let queue = socketWrapper[QUEUE_SYMBOL]

    if (!queue) {
      queue = new MessageQueue(this._options, socketWrapper)
      queue.onAuthenticatedMessage = this.onAuthenticatedMessage
      socketWrapper[QUEUE_SYMBOL] = queue
    }

    queue.process(message)
  }
}
