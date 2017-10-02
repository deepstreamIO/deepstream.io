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
  private topic: string
  private options: any
  private data: any

  /**
  * Initialises the DistributedStateRegistry and subscribes to the provided cluster topic
  */
  constructor (topic: string, options: any) {
    super()
    this.topic = topic
    this.options = options
    this.data = {}
  }

  whenReady (callback: Function): void {
  }

  /**
  * Checks if a given entry exists within the registry
  */
  has (name: string): boolean {
    return !!this.data[name]
  }

  /**
  * Add a name/entry to the registry. If the entry doesn't exist yet,
  * this will notify the other nodes within the cluster
  */
  add (name: string): void {
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
  remove (name: string): void {
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
  removeAll (serverName: string): void {
  }

  /**
  * Returns all the servers that hold a given state
  */
  getAllServers (subscriptionName: string): Array<string> {
    return []
  }

  /**
  * Returns all currently registered entries
  *
  * @public
  * @returns {Array} entries
  */
  getAll (): Array<string> {
    return Object.keys(this.data)
  }

  getAllMap (): any {
    return this.data
  }
}
