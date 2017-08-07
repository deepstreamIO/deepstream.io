'use strict'

const LockRegistry = require('./cluster-unique-state-provider')
const ClusterRegistry = require('./cluster-registry')
const StateRegistry = require('./distributed-state-registry')

module.exports = class MessageConnector {

  constructor (options) {
    this._options = options
    this._isReady = true
    this._cluster = this
    this._stateRegistries = new Map()
    this._options.clusterRegistry = new ClusterRegistry(this._options, this)
    this._options.uniqueRegistry = new LockRegistry(this._options, this)
    this._bus = this._options.messageConnector
  }

  sendBroadcast (name, message) {
    message.__originServer = this._options.serverName
    this._options.messageConnector.publish(name, message)
  }

  subscribeBroadcast (name, callback) {
    this._options.messageConnector.subscribe(name, (message) => {
      if (message.__originServer === this._options.serverName) {
        return
      }
      callback(message)
    })
  }

  send (name, message) {
    const recordName = message.action === 'A' ? message.data[1] : message.data[0]
    const serverNames = this.getStateRegistry(`${message.topic}_SUB`).getAllServers(recordName)

    for (let i = 0; i < serverNames.length; i++) {
      if (serverNames[i] === this._options.serverName) {
        continue
      }
      this._options.messageConnector.publish(`${serverNames[i]}/${name}`, message)
    }
  }

  sendDirect (serverName, name, message) {
    message.__originServer = this._options.serverName
    this._options.messageConnector.publish(`${serverName}/${name}`, message)
  }

  subscribe (name, callback) {
    this._options.messageConnector.subscribe(`${this._options.serverName}/${name}`, (message) => {
      const serverName = message.__originServer
      delete message.__originServer
      callback(message, serverName)
    })
  }

  /**
   * Returns the serverNames of all nodes currently present within the cluster
   *
   * @public
   * @returns {Array} serverNames
   */
  getAll () {
    return this._options.clusterRegistry.getAll()
  }

  /**
   * Returns true if this node is the cluster leader
   * @return {Boolean} [description]
   */
  isLeader () {
    return this._options.clusterRegistry.isLeader()
  }

  /**
  * Returns the name of the current leader
  * @return {String}
  */
  getCurrentLeader () {
    return this._options.clusterRegistry.getCurrentLeader()
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
