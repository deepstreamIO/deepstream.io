'use strict'

const ClusterRegistry = require('../cluster/cluster-registry')
const StateRegistry = require('../cluster/distributed-state-registry')

module.exports = class MessageConnector {

  constructor (options) {
    this._options = options
    this._isReady = true
    this._options.message = this
    this._options.clusterRegistry = new ClusterRegistry(this._options)
    this._stateRegistries = new Map()
    this._bus = this._options.messageConnector
  }

  send (name, message) {
    this._options.messageConnector.publish(name, message)
  }

  sendDirect (serverName, name, message) {

  }

  subscribe (topic, callback) {
    this._options.messageConnector.subscribe(topic, callback)
  }

  /**
   * Returns the serverNames of all nodes currently present within the cluster
   *
   * @public
   * @returns {Array} serverNames
   */
  getAll () {
    return this._cluster.getAll()
  }

  /**
   * Returns true if this node is the cluster leader
   * @return {Boolean} [description]
   */
  isLeader () {
    return this._cluster.isLeader()
  }

  /**
  * Returns the name of the current leader
  * @return {String}
  */
  getCurrentLeader () {
    return this._cluster.getCurrentLeader()
  }

  getStateRegistry (name) {
    let registry = this._stateRegistries.get(name)
    if (!registry) {
      registry = new StateRegistry(name, this._options)
      this._stateRegistries.set(name, registry)
    }
    return registry
  }

}
