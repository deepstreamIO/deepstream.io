import { EVENT, TOPIC } from '../constants'

/**
 * The MessageDistributor routes valid and permissioned messages to
 * various, previously registered handlers, e.g. event-, rpc- or recordHandler
 */
export default class MessageDistributor {
  private _callbacks: any
  private _options: DeepstreamConfig
  private _services: DeepstreamServices

  constructor (options: DeepstreamConfig, services: DeepstreamServices) {
    this._callbacks = {}
    this._options = options
    this._services = services
  }

  /**
   * Accepts a socketWrapper and a parsed message as input and distributes
   * it to its subscriber, based on the message's topic
   */
  public distribute (socketWrapper: SocketWrapper, message: Message) {
    if (this._callbacks[message.topic] === undefined) {
      this._services.logger.warn(EVENT.UNKNOWN_TOPIC, TOPIC[message.topic])
      socketWrapper.sendError({
        topic: TOPIC.ERROR
      }, EVENT.UNKNOWN_TOPIC, TOPIC[message.topic])
      return
    }

    // TODO: Can we remove this? A general emit is quite expensive
    // socketWrapper.emit(message.topic, message)

    // if (message.isCompleted !== true) {
      this._callbacks[message.topic](socketWrapper, message)
    // }
  }

  /**
   * Allows handlers (event, rpc, record) to register for topics. Subscribes them
   * to both messages passed to the distribute method as well as messages received
   * from the messageConnector
   */
  public registerForTopic (topic: string, callback: Function) {
    if (this._callbacks[topic] !== undefined) {
      throw new Error(`Callback already registered for topic ${topic}`)
    }

    this._callbacks[topic] = callback
    this._services.message.subscribe(
      topic,
      this._onMessageConnectorMessage.bind(this, callback)
    )
  }

  /**
   * Whenever a message from the messageConnector is received it is passed
   * to the relevant handler, but with SOURCE_MESSAGE_CONNECTOR instead of
   * a socketWrapper as sender
   */
  private _onMessageConnectorMessage (callback: Function, message: Message, originServer: string) {
    // callback(SOURCE_MESSAGE_CONNECTOR, message, originServer)
  }
}
