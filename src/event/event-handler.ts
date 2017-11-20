import { EVENT, EVENT_ACTIONS, PRESENCE_ACTIONS, RECORD_ACTIONS, RPC_ACTIONS, TOPIC, EventMessage, ListenMessage } from '../constants'
import ListenerRegistry from '../listen/listener-registry'
import SubscriptionRegistry from '../utils/subscription-registry'

export default class EventHandler {
  private metaData: any
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private subscriptionRegistry: SubscriptionRegistry
  private listenerRegistry: ListenerRegistry
  private logger: Logger

  /**
   * Handles incoming and outgoing messages for the EVENT topic.
   */
  constructor (config: DeepstreamConfig, services: DeepstreamServices, subscriptionRegistry?: SubscriptionRegistry, listenerRegistry?: ListenerRegistry) {
    this.config = config
    this.subscriptionRegistry =
      subscriptionRegistry || new SubscriptionRegistry(config, services, TOPIC.EVENT, TOPIC.EVENT_SUBSCRIPTIONS)
    this.listenerRegistry =
      listenerRegistry || new ListenerRegistry(TOPIC.EVENT, config, services, this.subscriptionRegistry, null)
    this.subscriptionRegistry.setSubscriptionListener(this.listenerRegistry)
    this.logger = services.logger
  }

  /**
   * The main distribution method. Routes messages to functions
   * based on the provided action parameter of the message
   */
  public handle (socket: SocketWrapper, message: EventMessage) {
    if (message.action === EVENT_ACTIONS.SUBSCRIBE) {
      this.subscriptionRegistry.subscribe(message, socket)
    } else if (message.action === EVENT_ACTIONS.UNSUBSCRIBE) {
      this.subscriptionRegistry.unsubscribe(message, socket)
    } else if (message.action === EVENT_ACTIONS.EMIT) {
      this.triggerEvent(socket, message)
    } else if (message.action === EVENT_ACTIONS.LISTEN ||
      message.action === EVENT_ACTIONS.UNLISTEN ||
      message.action === EVENT_ACTIONS.LISTEN_ACCEPT ||
      message.action === EVENT_ACTIONS.LISTEN_REJECT) {
      this.listenerRegistry.handle(socket, message as ListenMessage)
    } else {
      console.log('unknown action', message)
    }
  }

  /**
   * Notifies subscribers of events. This method is invoked for the EVENT action. It can
   * be triggered by messages coming in from both clients and the message connector.
   */
  public triggerEvent (socket: SocketWrapper, message: EventMessage) {
    this.logger.debug(EVENT_ACTIONS[EVENT_ACTIONS.EMIT], `event: ${message.name} with data: ${message.data}`)
    this.subscriptionRegistry.sendToSubscribers(message.name, message, false, socket)
  }
}
