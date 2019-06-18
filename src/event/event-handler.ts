import { EVENT_ACTIONS, TOPIC, EventMessage, ListenMessage } from '../constants'
import ListenerRegistry from '../listen/listener-registry'
import SubscriptionRegistry from '../utils/subscription-registry'
import { InternalDeepstreamConfig, DeepstreamServices, SocketWrapper, Handler } from '../types'

export default class EventHandler implements Handler<EventMessage> {
  private subscriptionRegistry: SubscriptionRegistry
  private listenerRegistry: ListenerRegistry

  /**
   * Handles incoming and outgoing messages for the EVENT topic.
   */

  constructor (config: InternalDeepstreamConfig, private services: DeepstreamServices, subscriptionRegistry?: SubscriptionRegistry, listenerRegistry?: ListenerRegistry) {
    this.subscriptionRegistry =
      subscriptionRegistry || services.subscriptions.getSubscriptionRegistry(TOPIC.EVENT, TOPIC.EVENT_SUBSCRIPTIONS)
    this.listenerRegistry =
      listenerRegistry || new ListenerRegistry(TOPIC.EVENT, config, services, this.subscriptionRegistry, null)
    this.subscriptionRegistry.setSubscriptionListener(this.listenerRegistry)
  }

  /**
   * The main distribution method. Routes messages to functions
   * based on the provided action parameter of the message
   */
  public handle (socketWrapper: SocketWrapper | null, message: EventMessage) {
    if (message.action === EVENT_ACTIONS.SUBSCRIBE) {
      this.subscriptionRegistry.subscribe(message, socketWrapper!)
    } else if (message.action === EVENT_ACTIONS.UNSUBSCRIBE) {
      this.subscriptionRegistry.unsubscribe(message, socketWrapper!)
    } else if (message.action === EVENT_ACTIONS.EMIT) {
      this.triggerEvent(socketWrapper, message)
    } else if (message.action === EVENT_ACTIONS.LISTEN ||
      message.action === EVENT_ACTIONS.UNLISTEN ||
      message.action === EVENT_ACTIONS.LISTEN_ACCEPT ||
      message.action === EVENT_ACTIONS.LISTEN_REJECT) {
      this.listenerRegistry.handle(socketWrapper!, message as ListenMessage)
    } else {
      console.log('unknown action', message)
    }
  }

  /**
   * Notifies subscribers of events. This method is invoked for the EVENT action. It can
   * be triggered by messages coming in from both clients and the message connector.
   */
  public triggerEvent (socket: SocketWrapper | null, message: EventMessage) {
    this.services.logger.debug(EVENT_ACTIONS[EVENT_ACTIONS.EMIT], `event: ${message.name} with data: ${message.data}`)
    this.subscriptionRegistry.sendToSubscribers(message.name, message, false, socket)
  }
}
