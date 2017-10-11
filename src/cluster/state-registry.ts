import { TOPIC, EVENT } from '../constants'
import { EventEmitter } from 'events'

/**
 * This class provides a generic mechanism that allows to maintain
 * a distributed state amongst the nodes of a cluster.
 *
 * @extends {EventEmitter}
 *
 * @event 'add' emitted whenever an entry is added for the first time
 * @event 'remove' emitted whenever an entry is removed by the last node
 *
 * @author DeepstreamHub GmbH 2016
 */
export default class StateRegistry extends EventEmitter {
  private topic: TOPIC
  private options: any
  private data: any

  /**
  * Initialises the DistributedStateRegistry and subscribes to the provided cluster topic
  */
  constructor (topic: TOPIC, options: any) {
    super()
    this.topic = topic
    this.options = options
    this.data = {}
  }

  public whenReady (callback: Function): void {
  }

  /**
  * Checks if a given entry exists within the registry
  */
  public has (name: string): boolean {
    return !!this.data[name]
  }

  /**
  * Add a name/entry to the registry. If the entry doesn't exist yet,
  * this will notify the other nodes within the cluster
  */
  public add (name: string): void {
    if (!this.data[name]) {
      this.data[name] = 1
      this.emit('add', name)
    } else {
      this.data[name]++
    }
  }

  /**
  * Removes a name/entry from the registry. If the entry doesn't exist,
  * this will exit silently
  *
  * @param {String} name any previously added name
  *
  * @public
  * @returns {void}
  */
  public remove (name: string): void {
    this.data[name]--
    if (!this.data[name]) {
      delete this.data[name]
      this.emit('remove', name)
    }
  }

  /**
  * Removes all entries for a given serverName. This is intended to be called
  * whenever a node leaves the cluster
  */
  public removeAll (serverName: string): void {
  }

  /**
  * Returns all the servers that hold a given state
  */
  public getAllServers (subscriptionName: string): Array<string> {
    return []
  }

  /**
  * Returns all currently registered entries
  *
  * @public
  * @returns {Array} entries
  */
  public getAll (): Array<string> {
    return Object.keys(this.data)
  }

  public getAllMap (): any {
    return this.data
  }
}
