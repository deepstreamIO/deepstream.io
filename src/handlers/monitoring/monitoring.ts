import { DeepstreamConfig, DeepstreamServices, SubscriptionRegistry, SocketWrapper, Handler } from '@deepstream/types'
import { MonitoringMessage } from '../../constants'

export default class MonitoringHandler extends Handler<MonitoringMessage> {
  // private subscriptionRegistry: SubscriptionRegistry

  /**
   * Handles incoming and outgoing messages for the EVENT topic.
   */
  constructor (config: DeepstreamConfig, services: DeepstreamServices, subscriptionRegistry?: SubscriptionRegistry) {
    super()
    // this.subscriptionRegistry =
    // subscriptionRegistry || services.subscriptions.getSubscriptionRegistry(TOPIC.MONITORING, TOPIC.MONITORING_SUBSCRIPTIONS)
  }

  /**
   * The main distribution method. Routes messages to functions
   * based on the provided action parameter of the message
   */
  public handle (socket: SocketWrapper, message: MonitoringMessage) {
    console.log('unknown action', message)
  }
}
