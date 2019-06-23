import { EVENT_ACTIONS, RECORD_ACTIONS, TOPIC, ListenMessage } from '../constants'
import { SocketWrapper, Provider } from '../types'

export default class ListenerTimeoutRegistry {
  private timeoutMap: { [index: string]: NodeJS.Timeout }
  private timedoutProviders: { [index: string]: Provider[] }
  private acceptedProvider: { [index: string]: Provider }
  private actions: any

  /**
  * The ListenerTimeoutRegistry is responsible for keeping track of listeners that have
  * been asked whether they want to provide a certain subscription, but have not yet
  * responded.
  */
  // @ts-ignore
  constructor (private readonly topic: TOPIC, private config: DeepstreamConfig, private services: DeepstreamServices) {
    this.actions = topic === TOPIC.RECORD ? RECORD_ACTIONS : EVENT_ACTIONS
    this.timeoutMap = {}
    this.timedoutProviders = {}
    this.acceptedProvider = {}
  }

  /**
    * The main entry point, which takes a message from a provider
    * that has already timed out and does the following:
    *
    * 1) If reject, remove from map
    * 2) If accept, store as an accepted and reject all following accepts
    */
  public handle (socketWrapper: SocketWrapper, message: ListenMessage): void {
    const subscriptionName = message.subscription
    const index = this.getIndex(socketWrapper, message)
    const provider = this.timedoutProviders[subscriptionName][index]
    if (message.action === this.actions.LISTEN_ACCEPT) {
      if (!this.acceptedProvider[subscriptionName]) {
        this.acceptedProvider[subscriptionName] = this.timedoutProviders[subscriptionName][index]
      } else {
        provider.socketWrapper.sendMessage({
          topic: this.topic,
          action: this.actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
          name: provider.pattern,
          subscription: subscriptionName,
        })
      }
    } else if (message.action === this.actions.LISTEN_REJECT) {
      this.timedoutProviders[subscriptionName].splice(index, 1)
    }
  }

  /**
    * Clear cache once discovery phase is complete
    */
  public clear (subscriptionName: string): void {
    delete this.timeoutMap[subscriptionName]
    delete this.timedoutProviders[subscriptionName]
    delete this.acceptedProvider[subscriptionName]
  }

  /**
    * Called whenever a provider closes to ensure cleanup
    */
  public removeProvider (socketWrapper: SocketWrapper): void {
    for (const acceptedProvider in this.acceptedProvider) {
      if (this.acceptedProvider[acceptedProvider].socketWrapper === socketWrapper) {
        delete this.acceptedProvider[acceptedProvider]
      }
    }
    for (const subscriptionName in this.timeoutMap) {
      if (this.timeoutMap[subscriptionName]) {
        this.clearTimeout(subscriptionName)
      }
    }
  }

  /**
  * Starts a timeout for a provider. The following cases can apply
  *
  * Provider accepts within the timeout: We stop here
  * Provider rejects within the timeout: We ask the next provider
  * Provider doesn't respond within the timeout: We ask the next provider
  *
  * Provider accepts after the timeout:
  *  If no other provider accepted yet, we'll wait for the current request to end and stop here
  *  If another provider has accepted already, we'll immediatly send a SUBSCRIPTION_REMOVED message
  */
  public addTimeout (subscriptionName: string, provider: Provider, callback: Function): void {
    const timeoutId = setTimeout(() => {
      if (this.timedoutProviders[subscriptionName] == null) {
        this.timedoutProviders[subscriptionName] = []
      }
      this.timedoutProviders[subscriptionName].push(provider)
      provider.socketWrapper.sendMessage({
        topic: this.topic,
        action: this.actions.LISTEN_RESPONSE_TIMEOUT,
        subscription: subscriptionName
      })
      callback(subscriptionName)
    }, this.config.listen.responseTimeout)
    this.timeoutMap[subscriptionName] = timeoutId
  }

  /**
    * Clear the timeout for a LISTEN_ACCEPT or LISTEN_REJECT recieved
    * by the listen registry
    */
  public clearTimeout (subscriptionName: string): void {
    clearTimeout(this.timeoutMap[subscriptionName])
    delete this.timeoutMap[subscriptionName]
  }

  /**
    * Return if the socket is a provider that previously timeout
    */
  public isALateResponder (socketWrapper: SocketWrapper, message: ListenMessage): boolean {
    const index = this.getIndex(socketWrapper, message)
    return this.timedoutProviders[message.subscription] && index !== -1
  }

  /**
    * Return if the socket is a provider that previously timeout
    */
  public rejectLateResponderThatAccepted (subscriptionName: string): void {
    const provider = this.acceptedProvider[subscriptionName]
    if (provider) {
      provider.socketWrapper.sendMessage({
        topic: this.topic,
        action: this.actions.SUBSCRIPTION_FOR_PATTERN_REMOVED,
        name: provider.pattern,
        subscription: subscriptionName,
      })
    }
  }

  /**
    * Return if the socket is a provider that previously timeout
    */
  public getLateResponderThatAccepted (subscriptionName: string): Provider {
    return this.acceptedProvider[subscriptionName]
  }

  /**
    * Return if the socket is a provider that previously timeout
    */
  private getIndex (socketWrapper: SocketWrapper, message: ListenMessage): number {
    const pattern = message.name
    const subscriptionName = message.subscription
    const timedoutProviders = this.timedoutProviders[subscriptionName]

    if (timedoutProviders) {
      for (let i = 0; i < timedoutProviders.length; i++) {
        if (
          timedoutProviders[i].socketWrapper === socketWrapper &&
          timedoutProviders[i].pattern === pattern
        ) {
          return i
        }
      }
    }

    return -1
  }
}
