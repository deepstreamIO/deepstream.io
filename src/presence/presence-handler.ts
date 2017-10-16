import { PRESENCE_ACTIONS, TOPIC, PARSER_ACTIONS } from '../constants'
import StateRegistry from '../cluster/state-registry'
import SubscriptionRegistry from '../utils/subscription-registry'

const EVERYONE = PRESENCE_ACTIONS[PRESENCE_ACTIONS.EVERYONE]

function parseUserNames (data: any): Array<string> | null {
  // Returns all users for backwards compatability
  if (
    !data ||
    data === 'S' ||
    data === 'U'
  ) {
    return [EVERYONE]
  }
  try {
    return JSON.parse(data)
  } catch (e) {
    return null
  }
}

/**
 * This class handles incoming and outgoing messages in relation
 * to deepstream presence. It provides a way to inform clients
 * who else is logged into deepstream
 */
export default class PresenceHandler {
  private metaData: any
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private localClients: Map<string, number>
  private subscriptionRegistry: SubscriptionRegistry
  private connectedClients: StateRegistry

  constructor (config: DeepstreamConfig, services: DeepstreamServices, subscriptionRegistry?: SubscriptionRegistry, stateRegistry?: StateRegistry, metaData?: any) {
    this.metaData = metaData
    this.config = config
    this.services = services
    this.localClients = new Map()

    this.subscriptionRegistry =
      subscriptionRegistry || new SubscriptionRegistry(config, services, TOPIC.PRESENCE, TOPIC.PRESENCE_SUBSCRIPTIONS)

    this.connectedClients =
      stateRegistry || this.services.message.getStateRegistry(TOPIC.ONLINE_USERS)
    this.connectedClients.on('add', this.onClientAdded.bind(this))
    this.connectedClients.on('remove', this.onClientRemoved.bind(this))
  }

  /**
  * The main entry point to the presence handler class.
  *
  * Handles subscriptions, unsubscriptions and queries
  */
  public handle (socketWrapper: SocketWrapper, message: PresenceMessage): void {
    if (message.action === PRESENCE_ACTIONS.QUERY_ALL) {
      this.handleQueryAll(message.correlationId, socketWrapper)
      return
    }

    console.log(message)
    const users = parseUserNames(message.data)
    if (!users) {
      this.services.logger.error(PRESENCE_ACTIONS[PRESENCE_ACTIONS.INVALID_PRESENCE_USERS], message.data, this.metaData)
      socketWrapper.sendError(message, PRESENCE_ACTIONS.INVALID_PRESENCE_USERS)
      return
    }
    if (message.action === PRESENCE_ACTIONS.SUBSCRIBE) {
      for (let i = 0; i < users.length; i++) {
        this.subscriptionRegistry.subscribe({
          topic: TOPIC.PRESENCE,
          action: PRESENCE_ACTIONS.SUBSCRIBE,
          name: users[i],
        }, socketWrapper)
      }
    } else if (message.action === PRESENCE_ACTIONS.UNSUBSCRIBE) {
      for (let i = 0; i < users.length; i++) {
        this.subscriptionRegistry.unsubscribe({
          topic: TOPIC.PRESENCE,
          action: PRESENCE_ACTIONS.UNSUBSCRIBE,
          name: users[i],
        }, socketWrapper)
      }
    } else if (message.action === PRESENCE_ACTIONS.QUERY) {
      this.handleQuery(users, message.correlationId, socketWrapper)
    } else {
      this.services.logger.warn(PARSER_ACTIONS[PARSER_ACTIONS.UNKNOWN_ACTION], PRESENCE_ACTIONS[message.action], this.metaData)
    }
  }

  /**
  * Called whenever a client has succesfully logged in with a username
  */
  public handleJoin (socketWrapper: SocketWrapper): void {
    const currentCount = this.localClients.get(socketWrapper.user)
    if (currentCount === undefined) {
      this.localClients.set(socketWrapper.user, 1)
      this.connectedClients.add(socketWrapper.user)
    } else {
      this.localClients.set(socketWrapper.user, currentCount + 1)
    }
  }

  /**
  * Called whenever a client has disconnected
  */
  public handleLeave (socketWrapper: SocketWrapper): void {
    const currentCount = this.localClients.get(socketWrapper.user)
    if (!currentCount) {
      // TODO: Log Error
    } else if (currentCount === 1) {
      this.localClients.delete(socketWrapper.user)
      this.connectedClients.remove(socketWrapper.user)
    } else {
      this.localClients.set(socketWrapper.user, currentCount - 1)
    }
  }

  private handleQueryAll (correlationId: string, socketWrapper: SocketWrapper): void {
    const clients = this.connectedClients.getAll()
    const index = clients.indexOf(socketWrapper.user)
    if (index !== -1) {
      clients.splice(index, 1)
    }
    socketWrapper.sendMessage({
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTIONS.QUERY_ALL_RESPONSE,
      name: PRESENCE_ACTIONS[PRESENCE_ACTIONS.QUERY_ALL_RESPONSE],
      parsedData: clients,
    })
  }

  /**
  * Handles finding clients who are connected and splicing out the client
  * querying for users
  */
  private handleQuery (users: Array<string>, correlationId: string, socketWrapper: SocketWrapper): void {
    const result = {}
    const clients = this.connectedClients.getAll()
    for (let i = 0; i < users.length; i++) {
      result[users[i]] = !!clients[users[i]]
    }
    socketWrapper.sendMessage({
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTIONS.QUERY,
      name: PRESENCE_ACTIONS[PRESENCE_ACTIONS.QUERY],
      correlationId,
      parsedData: result,
    })
  }

  /**
  * Alerts all clients who are subscribed to
  * PRESENCE_JOIN that a new client has been added.
  */
  private onClientAdded (username: string) {
    const message = {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTIONS.PRESENCE_JOIN,
      name : username,
    }

    this.subscriptionRegistry.sendToSubscribers(
      EVERYONE, message, false, null, false,
    )
    this.subscriptionRegistry.sendToSubscribers(
      username, message, false, null, false,
    )
  }

  /**
  * Alerts all clients who are subscribed to
  * PRESENCE_LEAVE that the client has left.
  */
  private onClientRemoved (username: string) {
    const message = {
      topic: TOPIC.PRESENCE,
      action: PRESENCE_ACTIONS.PRESENCE_LEAVE,
      name: username,
    }
    this.subscriptionRegistry.sendToSubscribers(
      EVERYONE, message, false, null, false,
    )
    this.subscriptionRegistry.sendToSubscribers(
      username, message, false, null, false,
    )
  }
}
