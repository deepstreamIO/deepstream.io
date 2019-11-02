import { PARSER_ACTION, PRESENCE_ACTION, TOPIC, PresenceMessage, Message, BulkSubscriptionMessage, STATE_REGISTRY_TOPIC } from '../../constants'
import { DeepstreamConfig, DeepstreamServices, SocketWrapper, StateRegistry, Handler, SubscriptionRegistry, ConnectionListener } from '@deepstream/types'
import { Dictionary } from 'ts-essentials'

const EVERYONE = '%_EVERYONE_%'

/**
 * This class handles incoming and outgoing messages in relation
 * to deepstream presence. It provides a way to inform clients
 * who else is logged into deepstream
 */
export default class PresenceHandler extends Handler<PresenceMessage> implements ConnectionListener {
  private localClients: Map<string, number> = new Map()
  private subscriptionRegistry: SubscriptionRegistry
  private connectedClients: StateRegistry

  constructor (config: DeepstreamConfig, private services: DeepstreamServices, subscriptionRegistry?: SubscriptionRegistry, stateRegistry?: StateRegistry, private metaData?: any) {
    super()

    this.subscriptionRegistry =
      subscriptionRegistry || services.subscriptions.getSubscriptionRegistry(TOPIC.PRESENCE, STATE_REGISTRY_TOPIC.PRESENCE_SUBSCRIPTIONS)

    this.connectedClients =
      stateRegistry || this.services.clusterStates.getStateRegistry(STATE_REGISTRY_TOPIC.ONLINE_USERS)

    this.connectedClients.onAdd(this.onClientAdded.bind(this))
    this.connectedClients.onRemove(this.onClientRemoved.bind(this))
  }

  /**
  * The main entry point to the presence handler class.
  *
  * Handles subscriptions, unsubscriptions and queries
  */
  public handle (socketWrapper: SocketWrapper, message: PresenceMessage): void {
    if (message.action === PRESENCE_ACTION.QUERY_ALL) {
      this.handleQueryAll(message.correlationId, socketWrapper)
      return
    }

    if (message.action === PRESENCE_ACTION.SUBSCRIBE_ALL) {
      this.subscriptionRegistry.subscribe(EVERYONE, {
        topic: TOPIC.PRESENCE,
        action: PRESENCE_ACTION.SUBSCRIBE_ALL,
        name: EVERYONE
      }, socketWrapper, true)
      socketWrapper.sendAckMessage({
        topic: message.topic,
        action: message.action
      })
      return
    }

    if (message.action === PRESENCE_ACTION.UNSUBSCRIBE_ALL) {
      this.subscriptionRegistry.unsubscribe(EVERYONE, {
        topic: TOPIC.PRESENCE,
        action: PRESENCE_ACTION.UNSUBSCRIBE_ALL,
        name: EVERYONE
      }, socketWrapper, true)
      socketWrapper.sendAckMessage({
        topic: message.topic,
        action: message.action
      })
      return
    }

    const users = message.names
    if (!users) {
      this.services.logger.error(
        PARSER_ACTION[PARSER_ACTION.INVALID_MESSAGE],
        `invalid presence names parameter ${PRESENCE_ACTION[message.action]}`
      )
      return
    }

    if (message.action === PRESENCE_ACTION.SUBSCRIBE) {
      this.subscriptionRegistry.subscribeBulk(message as BulkSubscriptionMessage, socketWrapper)
      return
    }

    if (message.action === PRESENCE_ACTION.UNSUBSCRIBE) {
      this.subscriptionRegistry.unsubscribeBulk(message as BulkSubscriptionMessage, socketWrapper)
      return
    }

    if (message.action === PRESENCE_ACTION.QUERY) {
      this.handleQuery(users, message.correlationId, socketWrapper)
      return
    }

    this.services.logger.warn(PARSER_ACTION[PARSER_ACTION.UNKNOWN_ACTION], PRESENCE_ACTION[message.action], this.metaData)
  }

  /**
  * Called whenever a client has succesfully logged in with a username
  */
  public onClientConnected (socketWrapper: SocketWrapper): void {
    if (socketWrapper.userId === 'OPEN') {
      return
    }
    const currentCount = this.localClients.get(socketWrapper.userId)
    if (currentCount === undefined) {
      this.localClients.set(socketWrapper.userId, 1)
      this.connectedClients.add(socketWrapper.userId)
    } else {
      this.localClients.set(socketWrapper.userId, currentCount + 1)
    }
  }

  /**
  * Called whenever a client has disconnected
  */
  public onClientDisconnected (socketWrapper: SocketWrapper): void {
    if (socketWrapper.userId === 'OPEN') {
      return
    }
    const currentCount = this.localClients.get(socketWrapper.userId)
    if (!currentCount) {
      // TODO: Log Error
    } else if (currentCount === 1) {
      this.localClients.delete(socketWrapper.userId)
      this.connectedClients.remove(socketWrapper.userId)
    } else {
      this.localClients.set(socketWrapper.userId, currentCount - 1)
    }
  }

  private handleQueryAll (correlationId: string, socketWrapper: SocketWrapper): void {
    const clients = this.connectedClients.getAll()
    const index = clients.indexOf(socketWrapper.userId)
    if (index !== -1) {
      clients.splice(index, 1)
    }
    socketWrapper.sendMessage({
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTION.QUERY_ALL_RESPONSE,
      names: clients
    })
  }

  /**
  * Handles finding clients who are connected and splicing out the client
  * querying for users
  */
  private handleQuery (users: string[], correlationId: string, socketWrapper: SocketWrapper): void {
    const result: Dictionary<boolean> = {}
    const clients = this.connectedClients.getAll()
    for (let i = 0; i < users.length; i++) {
      result[users[i]] = clients.includes(users[i])
    }
    socketWrapper.sendMessage({
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTION.QUERY_RESPONSE,
      correlationId,
      parsedData: result,
    })
  }

  /**
  * Alerts all clients who are subscribed to
  * PRESENCE_JOIN that a new client has been added.
  */
  private onClientAdded (username: string): void {
    const individualMessage: Message = {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTION.PRESENCE_JOIN,
      name : username,
    }

    const allMessage: Message = {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTION.PRESENCE_JOIN_ALL,
      name: username
    }

    this.subscriptionRegistry.sendToSubscribers(EVERYONE, allMessage, false, null, true)
    this.subscriptionRegistry.sendToSubscribers(username, individualMessage, false, null, true)
  }

  /**
  * Alerts all clients who are subscribed to
  * PRESENCE_LEAVE that the client has left.
  */
  private onClientRemoved (username: string): void {
    const individualMessage: Message = {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTION.PRESENCE_LEAVE,
      name : username,
    }

    const allMessage: Message = {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTION.PRESENCE_LEAVE_ALL,
      name: username
    }

    this.subscriptionRegistry.sendToSubscribers(EVERYONE, allMessage, false, null)
    this.subscriptionRegistry.sendToSubscribers(username, individualMessage, false, null)
  }
}
