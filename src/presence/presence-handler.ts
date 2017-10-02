import { TOPIC, ACTIONS, EVENT, PRESENCE } from '../constants'
import SubscriptionRegistry from '../utils/subscription-registry'
import StateRegistry from '../cluster/state-registry'

function parseUserNames (data: any): Array<string> {
  // Returns all users for backwards compatability
  if (
    !data ||
    data === ACTIONS.QUERY ||
    data === ACTIONS.SUBSCRIBE ||
    data === TOPIC.PRESENCE
  ) {
    return [PRESENCE.EVERYONE]
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
  private options: DeepstreamOptions
  private localClients: Map<string, number>
  private subscriptionRegistry: SubscriptionRegistry
  private connectedClients: StateRegistry

  constructor (options: DeepstreamOptions, subscriptionRegistry: SubscriptionRegistry, stateRegistry: StateRegistry, metaData: any) {
    this.metaData = metaData
    this.options = options
    this.localClients = new Map()

    this.subscriptionRegistry =
      subscriptionRegistry || new SubscriptionRegistry(options, TOPIC.PRESENCE)

    this.connectedClients =
      stateRegistry || this.options.message.getStateRegistry(TOPIC.ONLINE_USERS)
    this.connectedClients.on('add', this.onClientAdded.bind(this))
    this.connectedClients.on('remove', this.onClientRemoved.bind(this))
  }

  /**
  * The main entry point to the presence handler class.
  *
  * Handles subscriptions, unsubscriptions and queries
  */
  handle (socketWrapper: SocketWrapper, message: Message): void {
    const users = parseUserNames(message.data)
    if (!users) {
      this.options.logger.error(EVENT.INVALID_PRESENCE_USERS, message.data, this.metaData)
      socketWrapper.sendError(message, EVENT.INVALID_PRESENCE_USERS)
      return
    }
    if (message.action === ACTIONS.SUBSCRIBE) {
      for (let i = 0; i < users.length; i++) {
        this.subscriptionRegistry.subscribe({
          topic: TOPIC.PRESENCE,
          action: ACTIONS.SUBSCRIBE,
          name: users[i]
        }, socketWrapper)
      }
    } else if (message.action === ACTIONS.UNSUBSCRIBE) {
      for (let i = 0; i < users.length; i++) {
        this.subscriptionRegistry.unsubscribe({
          topic: TOPIC.PRESENCE,
          action: ACTIONS.UNSUBSCRIBE,
          name: users[i]
        }, socketWrapper)
      }
    } else if (message.action === ACTIONS.QUERY) {
      this.handleQuery(users, message.correlationId, socketWrapper)
    } else {
      this.options.logger.warn(EVENT.UNKNOWN_ACTION, message.action, this.metaData)
    }
  }

  /**
  * Called whenever a client has succesfully logged in with a username
  */
  public handleJoin (socketWrapper: SocketWrapper): void {
    let currentCount = this.localClients.get(socketWrapper.user)
    if (currentCount === undefined) {
      this.localClients.set(socketWrapper.user, 1)
      this.connectedClients.add(socketWrapper.user)
    } else {
      this.localClients.set(socketWrapper.user, ++currentCount)
    }
  }

  /**
  * Called whenever a client has disconnected
  */
  public handleLeave (socketWrapper: SocketWrapper): void {
    let currentCount = this.localClients.get(socketWrapper.user)
    if (currentCount === 1) {
      this.localClients.delete(socketWrapper.user)
      this.connectedClients.remove(socketWrapper.user)
    } else {
      this.localClients.set(socketWrapper.user, --currentCount)
    }
  }

  /**
  * Handles finding clients who are connected and splicing out the client
  * querying for users
  */
  private handleQuery (users: Array<string>, correlationId: string, socketWrapper: SocketWrapper): void {
    if (users[0] === PRESENCE.EVERYONE) {
      const clients = this.connectedClients.getAll()
      const index = clients.indexOf(socketWrapper.user)
      if (index !== -1) {
        clients.splice(index, 1)
      }
      socketWrapper.sendMessage({
        topic: TOPIC.PRESENCE,
        action: ACTIONS.QUERY,
        parsedData: clients
      })
    } else {
      const result = {}
      const clients = this.connectedClients.getAllMap()
      for (let i = 0; i < users.length; i++) {
        result[users[i]] = !!clients[users[i]]
      }
      socketWrapper.sendMessage({
        topic: TOPIC.PRESENCE,
        action: ACTIONS.QUERY,
        correlationId,
        parsedData: result
      })
    }
  }

  /**
  * Alerts all clients who are subscribed to
  * PRESENCE_JOIN that a new client has been added.
  */
  private onClientAdded (username: string) {
    const message = { 
      topic: TOPIC.PRESENCE, 
      action: ACTIONS.PRESENCE_JOIN, 
      parsedData: username 
    }

    this.subscriptionRegistry.sendToSubscribers(
      PRESENCE.EVERYONE, message, false, null, false
    )
    this.subscriptionRegistry.sendToSubscribers(
      username, message, false, null, false
    )
  }

  /**
  * Alerts all clients who are subscribed to
  * PRESENCE_LEAVE that the client has left.
  */
  private onClientRemoved (username: string) {
    const message = { 
      topic: TOPIC.PRESENCE, 
      action: ACTIONS.PRESENCE_LEAVE, 
      parsedData: username 
    }
    this.subscriptionRegistry.sendToSubscribers(
      PRESENCE.EVERYONE, message, false, null, false
    )
    this.subscriptionRegistry.sendToSubscribers(
      username, message, false, null, false
    )
  }
}
