import { TOPIC, STATE_ACTION, StateMessage } from '../../constants'
import { DeepstreamServices, StateRegistry, StateRegistryCallback, DeepstreamConfig, EVENT } from '@deepstream/types'
import { Dictionary } from 'ts-essentials'
import { EventEmitter } from 'events'

export type DistributedStateRegistryOptions = any

/**
 * This class provides a generic mechanism that allows to maintain
 * a distributed state amongst the nodes of a cluster. The state is an
 * array of unique strings in arbitrary order.
 *
 * Whenever a string is added by any node within the cluster for the first time,
 * an 'add' event is emitted. Whenever its removed by the last node within the cluster,
 * a 'remove' event is emitted.
 */
export class DistributedStateRegistry implements StateRegistry {
  private isReady: boolean = false
  private data = new Map<string, {
    localCount: number,
    nodes: Set<string>,
    checkSum: number
  }>()
  private reconciliationTimeouts = new Map<string, NodeJS.Timeout>()
  private checkSumTimeouts = new Map<string, any[]>()
  private fullStateSent: boolean = false
  private initialServers = new Set<string>()
  private emitter = new EventEmitter()
  private logger = this.services.logger.getNameSpace('DISTRIBUTED_STATE_REGISTRY')

  /**
   * Initializes the DistributedStateRegistry and subscribes to the provided cluster topic
   */
  constructor (private topic: TOPIC, private stateOptions: any, private services: Readonly<DeepstreamServices>, private config: Readonly<DeepstreamConfig>) {
    this.resetFullStateSent = this.resetFullStateSent.bind(this)
    this.services.clusterNode.subscribe(TOPIC.STATE_REGISTRY, this.processIncomingMessage.bind(this))

    const serverNames = this.services.clusterRegistry.getAll()
    this.initialServers = new Set(serverNames)
    if (this.initialServers.size === 0) {
      this.isReady = true
      this.emitter.emit('ready')
    }

    this.initialServers.forEach((serverName) => {
      if (serverName !== this.config.serverName) {
        this.onServerAdded(serverName)
      }
    })

    this.services.clusterRegistry.onServerAdded(this.onServerAdded.bind(this))
    this.services.clusterRegistry.onServerRemoved(this.onServerRemoved.bind(this))
  }

  public async whenReady () {
    if (!this.isReady) {
      await new Promise((resolve) => this.emitter.once('ready', resolve))
    }
  }

  public onAdd (callback: StateRegistryCallback): void {
    this.emitter.on('add', callback)
  }

  public onRemove (callback: StateRegistryCallback): void {
    this.emitter.on('remove', callback)
  }

  /**
   * Checks if a given entry exists within the registry
   */
  public has (name: string) {
    return this.data.has(name)
  }

  /**
   * Add a name/entry to the registry. If the entry doesn't exist yet,
   * this will notify the other nodes within the cluster
   */
  public add (name: string) {
    const data = this.data.get(name)
    if (!data || !data.nodes.has(this.config.serverName)) {
      this.addToServer(name, this.config.serverName)
      this.sendMessage(name, STATE_ACTION.ADD)
    } else {
      data.localCount++
    }
  }

  /**
   * Removes a name/entry from the registry. If the entry doesn't exist,
   * this will exit silently
   */
  public remove (name: string) {
    const data = this.data.get(name)
    if (data) {
      data.localCount--
      if (data.localCount === 0) {
        this.removeFromServer(name, this.config.serverName)
        this.sendMessage(name, STATE_ACTION.REMOVE)
      }
    }
  }

  public removeAll (serverName: string): void {
    throw new Error('Method not implemented.')
  }

  /**
   * Informs the distributed state registry a server has been added to the cluster
   */
  public onServerAdded (serverName: string) {
    this._requestFullState(serverName)
  }

  /**
   * Removes all entries for a given serverName. This is intended to be called
   * whenever a node is removed from the cluster
   */
  public onServerRemoved (serverName: string) {
    for (const [name, value] of this.data) {
      if (value.nodes.has(serverName)) {
        this.removeFromServer(name, serverName)
      }
    }
  }

  /**
   * Returns all the servers that hold a given state
   */
  public getAllServers (name: string) {
    const data = this.data.get(name)
    if (data) {
      return [...data.nodes.keys()]
    }
    return []
  }

  /**
   * Returns all currently registered entries
   */
  public getAll (serverName: string): string[] {
    if (!serverName) {
      return [...this.data.keys()]
    }
    const entries: string[] = []
    for (const [name, value] of this.data) {
      if (value.nodes.has(serverName)) {
        entries.push(name)
      }
    }
    return entries
  }

  /**
   * Removes an entry for a given serverName. If the serverName
   * was the last node that held the entry, the entire entry will
   * be removed and a `remove` event will be emitted
   */
  private removeFromServer (name: string, serverName: string) {
    const data = this.data.get(name)
    if (!data) {
      return
    }
    data.nodes.delete(serverName)

    const exists = data.nodes.size !== 0

    if (exists === false) {
      this.data.delete(name)
      this.emitter.emit('remove', name)
    }

    this.emitter.emit('server-removed', name, serverName)
  }

  /**
   * Adds a new entry to this registry, either as a result of a remote or
   * a local addition. Will emit an `add` event if the entry wasn't present before
   */
  private addToServer (name: string, serverName: string) {
    let data = this.data.get(name)

    if (!data) {
      data = {
        localCount: 1,
        nodes: new Set(),
        checkSum: this.createCheckSum(name)
      }
      this.data.set(name, data)

      this.emitter.emit('add', name)
    }

    data.nodes.add(serverName)
    this.emitter.emit('server-added', name, serverName)
  }

  /**
   * Generic messaging function for add and remove messages
   */
  private sendMessage (name: string, action: STATE_ACTION) {
    this.services.clusterNode.send({
      topic: TOPIC.STATE_REGISTRY,
      registryTopic: this.topic,
      action,
      name
    })

    this.getCheckSumTotal(this.config.serverName, (checksum) =>
      this.services.clusterNode.send({
        topic: TOPIC.STATE_REGISTRY,
        registryTopic: this.topic,
        action: STATE_ACTION.CHECKSUM,
        checksum
      })
    )
  }

  /**
   * This method calculates the total checkSum for all local entries of
   * a given serverName
   */
  private getCheckSumTotal (serverName: string, callback: (checksum: number) => void): void {
    const callbacks = this.checkSumTimeouts.get(serverName)
    if (callbacks) {
      callbacks.push(callback)
    } else {
      this.checkSumTimeouts.set(serverName, [callback])

      setTimeout(() => {
        let totalCheckSum = 0

        for (const [, value] of this.data) {
          if (value.nodes.has(serverName)) {
            totalCheckSum += value.checkSum
          }
        }

        this.checkSumTimeouts.get(serverName)!.forEach((cb: (checksum: number) => void) => cb(totalCheckSum))
        this.checkSumTimeouts.delete(serverName)
      }, this.stateOptions.checkSumBuffer)
    }
  }

  /**
   * Calculates a simple checkSum for a given name. This is done up-front and cached
   * to increase performance for local add and remove operations. Arguably this is a generic
   * method and might be moved to the utils class if we find another usecase for it.
   */
  private createCheckSum (name: string) {
    let checkSum = 0
    let i

    for (i = 0; i < name.length; i++) {
      // tslint:disable-next-line:no-bitwise
      checkSum = ((checkSum << 5) - checkSum) + name.charCodeAt(i) // eslint-disable-line
    }

    return checkSum
  }

  /**
   * Checks a remote checkSum for a given serverName against the
   * actual checksum for all local entries for the given name.
   *
   * - If the checksums match, it removes all possibly pending
   *   reconciliationTimeouts
   *
   * - If the checksums don't match, it schedules a reconciliation request. If
   *   another message from the remote server arrives before the reconciliation request
   *   is send, it will be cancelled.
   */
  private verifyCheckSum (serverName: string, remoteCheckSum: number) {
    this.getCheckSumTotal(serverName, (checksum: number) => {
      if (checksum !== remoteCheckSum) {
        this.reconciliationTimeouts.set(serverName, setTimeout(
            this._requestFullState.bind(this, serverName),
            this.stateOptions.stateReconciliationTimeout
        ))
        return
      }

      const timeout = this.reconciliationTimeouts.get(serverName)
      if (timeout) {
        clearTimeout(timeout)
        this.reconciliationTimeouts.delete(serverName)
      }
    })
  }

  /**
   * Sends a reconciliation request for a server with a given name (technically, its send to
   * every node within the cluster, but will be ignored by all but the one with a matching name)
   *
   * The matching node will respond with a DISTRIBUTED_STATE_FULL_STATE message
   */
  private _requestFullState (serverName: string) {
    this.services.clusterNode.sendDirect(serverName, {
      topic: TOPIC.STATE_REGISTRY,
      registryTopic: this.topic,
      action: STATE_ACTION.REQUEST_FULL_STATE,
    })
  }

  /**
   * Creates a full state message containing an array of all local entries that
   * will be used to reconcile compromised states as well as provide the full state
   * for new nodes that joined the cluster
   *
   * When a state gets compromised, more than one remote registry might request a full state update.
   * This method will  schedule a timeout in which no additional full state messages are sent to
   * make sure only a single full state message is sent in reply.
   */
  public sendFullState (serverName: string): void {
    const localState: string[] = []

    for (const [name, value] of this.data) {
      if (value.nodes.has(this.config.serverName)) {
        localState.push(name)
      }
    }
    this.services.clusterNode.sendDirect(serverName, {
      topic: TOPIC.STATE_REGISTRY,
      registryTopic: this.topic,
      action: STATE_ACTION.FULL_STATE,
      fullState: localState
    })

    this.fullStateSent = true
    setTimeout(this.resetFullStateSent, this.stateOptions.stateReconciliationTimeout)
  }

  /**
   * This will apply the data from an incoming full state message. Entries that are not within
   * the incoming array will be removed for that node from the local registry and new entries will
   * be added.
   */
  private applyFullState (serverName: string, names: string[]) {
    const namesMap: Dictionary<boolean> = {}
    for (let i = 0; i < names.length; i++) {
      namesMap[names[i]] = true
    }

    Object.keys(this.data).forEach((name) => {
      // please note: only checking if the name exists is sufficient as the registry will just
      // set node[serverName] to false if the entry exists, but not for the remote server.
      if (!namesMap[name]) {
        this.removeFromServer(name, serverName)
      }
    })

    names.forEach((name) => this.addToServer(name, serverName))

    this.initialServers.delete(serverName)
    if (this.initialServers.size === 0) {
      this.isReady = true
      this.emitter.emit('ready')
    }
  }

  /**
   * Will be called after a full state message has been sent and
   * stateReconciliationTimeout has passed. This will allow further reconciliation
   * messages to be sent again.
   */
  private resetFullStateSent (): void {
    this.fullStateSent = false
  }

  /**
   * This is the main routing point for messages coming in from
   * the message connector.
   */
  private processIncomingMessage (message: StateMessage, serverName: string): void {
    if (message.registryTopic !== this.topic) {
      return
    }

    if (message.action === STATE_ACTION.ADD) {
      this.addToServer(message.name!, serverName)
      return
    }

    if (message.action === STATE_ACTION.REMOVE) {
      this.removeFromServer(message.name!, serverName)
      return
    }

    if (message.action === STATE_ACTION.REQUEST_FULL_STATE) {
      if (!message.data || this.fullStateSent === false) {
        this.sendFullState(serverName)
      } else {
        this.logger.error(EVENT.ERROR, `Ignoring a request for full state from ${serverName}`)
      }
      return
    }

    if (message.action === STATE_ACTION.FULL_STATE) {
      this.applyFullState(serverName, message.fullState!)
    }

    if (message.action === STATE_ACTION.CHECKSUM) {
      this.verifyCheckSum(serverName, message.checksum!)
    }
  }
}
