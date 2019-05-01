import { EventEmitter } from 'events'
import { TOPIC } from '../constants'

/**
 * This class provides a generic mechanism that allows to maintain
 * a distributed state amongst the nodes of a cluster.
 *
 * @event 'add' emitted whenever an entry is added for the first time
 * @event 'remove' emitted whenever an entry is removed by the last node
 */
export default class StateRegistry extends EventEmitter {
  private readonly data = new Map<string, number>()

  /**
  * Initialises the DistributedStateRegistry and subscribes to the provided cluster topic
  */
  constructor (private topic: TOPIC, private options: InternalDeepstreamConfig) {
    super()
  }

  /**
  * Checks if a given entry exists within the registry
  */
  public has (name: string): boolean {
    return this.data.has(name)
  }

  /**
  * Add a name/entry to the registry. If the entry doesn't exist yet,
  * this will notify the other nodes within the cluster
  */
  public add (name: string): void {
    const current = this.data.get(name)
    if (!current) {
      this.data.set(name, 1)
      this.emit('add', name)
    } else {
      this.data.set(name, current + 1)
    }
  }

  /**
  * Removes a name/entry from the registry. If the entry doesn't exist,
  * this will exit silently
  */
  public remove (name: string): void {
    const current = this.data.get(name)! - 1
    if (current === 0) {
      this.data.delete(name)
      this.emit('remove', name)
    } else {
      this.data.set(name, current)
    }
  }

  /**
  * Returns all currently registered entries
  */
  public getAll (): string[] {
    return [ ...this.data.keys() ]
  }

  public getAllMap (): Map<string, number> {
    return this.data
  }

  /**
   * Cluster placeholders
   */

  public whenReady (callback: Function): void {
  }

  /**
   * Returns all the servers that hold a given state
   */
  public getAllServers (subscriptionName: string): string[] {
    return []
  }

  /**
   * Removes all entries for a given serverName. This is intended to be called
   * whenever a node leaves the cluster
   */
  public removeAll (serverName: string): void {
  }
}
