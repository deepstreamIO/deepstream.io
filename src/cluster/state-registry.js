'use strict'

const EventEmitter = require('events').EventEmitter

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
module.exports = class StateRegistry extends EventEmitter {

  /**
  * Initialises the DistributedStateRegistry and subscribes to the provided cluster topic
  *
  * @param   {String} topic   A TOPIC constant
  * @param   {Object} options Global deepstream server options
  *
  * @constructor
  */
  constructor (topic, options) {
    super()
    this._topic = topic
    this._options = options
    this._data = {}
  }

  /**
  * Checks if a given entry exists within the registry
  *
  * @param   {String}  name       the name of the entry
  *
  * @public
  * @returns {Boolean} exists
  */
  has (name) {
    return !!this._data[name]
  }

  /**
  * Add a name/entry to the registry. If the entry doesn't exist yet,
  * this will notify the other nodes within the cluster
  *
  * @param {String} name any string key
  *
  * @public
  * @returns {void}
  */
  add (name) {
    if (!this._data[name]) {
      this._data[name] = 1
      this.emit('add', name)
    } else {
      this._data[name]++
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
  remove (name) {
    this._data[name]--
    if (!this._data[name]) {
      delete this._data[name]
      this.emit('remove', name)
    }
  }

  /**
  * Removes all entries for a given serverName. This is intended to be called
  * whenever a node leaves the cluster
  *
  * @param   {String} serverName The serverName of a node within the cluster
  *
  * @returns {[type]}
  */
  // eslint-disable-next-line
  removeAll () {
  }

  /**
  * Returns all the servers that hold a given state
  *
  * @public
  * @returns {Object} entries
  */
  // eslint-disable-next-line
  getAllServers () {
    return []
  }

  /**
  * Returns all currently registered entries
  *
  * @public
  * @returns {Array} entries
  */
  getAll () {
    return Object.keys(this._data)
  }

  getAllMap () {
    return this._data
  }
}
