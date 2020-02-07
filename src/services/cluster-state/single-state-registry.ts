import { StateRegistry, DeepstreamPlugin, StateRegistryCallback } from '@deepstream/types'
import { EventEmitter } from 'events'

/**
 * This class provides a generic mechanism that allows to maintain
 * a distributed state amongst the nodes of a cluster.
 */
export class SingleStateRegistry extends DeepstreamPlugin implements StateRegistry {
  public description: string = 'Single State Registry'
  private readonly data = new Map<string, number>()
  private emitter = new EventEmitter()

  /**
  * Checks if a given entry exists within the registry
  */
  public has (name: string): boolean {
    return this.data.has(name)
  }

  public onAdd (callback: StateRegistryCallback): void {
    this.emitter.on('add', callback)
  }

  public onRemove (callback: StateRegistryCallback): void {
    this.emitter.on('remove', callback)
  }

  /**
  * Add a name/entry to the registry. If the entry doesn't exist yet,
  * this will notify the other nodes within the cluster
  */
  public add (name: string): void {
    const current = this.data.get(name)
    if (!current) {
      this.data.set(name, 1)
      this.emitter.emit('add', name)
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
      this.emitter.emit('remove', name)
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
