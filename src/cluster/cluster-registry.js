'use strict'

const C = require('../constants/constants')
const EventEmitter = require('events').EventEmitter

/**
 * This class maintains a list of all nodes that are
 * currently present within the cluster.
 *
 * It provides status messages on a predefined interval
 * and keeps track of incoming status messages.
 *
 * @emits add <serverName>
 * @emits remove <serverName>
 */
module.exports = class ClusterRegistry extends EventEmitter {

  /**
   * Creates the class, initialises all intervals and publishes the
   * initial status message that notifies other nodes within this
   * cluster of its presence.
   *
   * @param   {Object} options            deepstream options
   * @param   {ConnectionEndpoint}    connectionEndpoint deepstream connection endpoint
   *
   * @constructor
   */
  constructor(options, connectionEndpoint) {
    super()
    this._options = options
    this._connectionEndpoint = connectionEndpoint
    this._inCluster = false
    this._nodes = {}

    this._leaderScore = Math.random()
    this.setMaxListeners(12)

    this._onMessageFn = this._onMessage.bind(this)
    this._leaveClusterFn = this.leaveCluster.bind(this)
    this._options.messageConnector.subscribe(C.TOPIC.CLUSTER, this._onMessageFn)
    this._publishStatus()
    this._publishInterval = setInterval(this._publishStatus.bind(this), this._options.clusterKeepAliveInterval)
    this._checkInterval = setInterval(this._checkNodes.bind(this), this._options.clusterActiveCheckInterval)
    process.on('beforeExit', this._leaveClusterFn)
    process.on('exit', this._leaveClusterFn)
  }

  /**
   * Prompts this node to leave the cluster, either as a result of a server.close() call or due to the process exiting.
   * This sends out a leave message to all other nodes and destroys this class.
   *
   * @public
   * @returns {[type]}
   */
  leaveCluster() {
    if (this._inCluster === false) {
      return
    }
    this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.CLUSTER_LEAVE, this._options.serverName)
    this._options.messageConnector.publish(C.TOPIC.CLUSTER, {
      topic: C.TOPIC.CLUSTER,
      action: C.ACTIONS.REMOVE,
      data: [this._options.serverName]
    })

    // TODO: If a message connector doesn't close this is required to avoid an error
    // being thrown during shutdown
    // this._options.messageConnector.unsubscribe( C.TOPIC.CLUSTER, this._onMessageFn );

    process.removeListener('beforeExit', this._leaveClusterFn)
    process.removeListener('exit', this._leaveClusterFn)
    clearInterval(this._publishInterval)
    clearInterval(this._checkInterval)
    this._nodes = {}
    this._inCluster = false
  }

  /**
   * Returns the serverNames of all nodes currently present within the cluster
   *
   * @public
   * @returns {Array} serverNames
   */
  getAll() {
    return Object.keys(this._nodes)
  }

  /**
   * Returns true if this node is the cluster leader
   * @return {Boolean} [description]
   */
  isLeader() {
    return this._options.serverName === this.getCurrentLeader()
  }

  /**
  * Returns the name of the current leader
  * @return {String}
  */
  getCurrentLeader() {
    let maxScore = 0
    let serverName
    let leader = null

    for (serverName in this._nodes) {
      if (this._nodes[serverName].leaderScore > maxScore) {
        maxScore = this._nodes[serverName].leaderScore
        leader = serverName
      }
    }

    return leader
  }

  /**
   * Returns the public url of the least utilized node within the cluster.
   *
   * @todo this currently only takes memory usage into account, but ignores the
   *       amount of connections. Improve?
   *
   * @public
   * @returns {String} public URL
   */
  getLeastUtilizedExternalUrl() {
    let minMemory = Infinity
    let serverName
    let minNode

    for (serverName in this._nodes) {
      if (this._nodes[serverName].memory < minMemory) {
        minMemory = this._nodes[serverName].memory
        minNode = this._nodes[serverName]
      }
    }

    return minNode.externalUrl
  }

  /**
   * Distributes incoming messages on the cluster topic
   *
   * @param   {Object} message parsed deepstream message object
   *
   * @private
   * @returns {void}
   */
  _onMessage(message) {
    const data = message.data[0]

    if (!data) {
      this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data)
    } else if (message.action === C.ACTIONS.STATUS) {
      this._updateNode(data)
    } else if (message.action === C.ACTIONS.REMOVE) {
      this._removeNode(data)
    } else {
      this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action)
    }
  }

  /**
   * Called on an interval defined by clusterActiveCheckInterval to check if all nodes
   * within the cluster are still alive.
   *
   * Being alive is defined as having received a status message from that node less than <clusterNodeInactiveTimeout>
   * milliseconds ago.
   *
   * @private
   * @returns {void}
   */
  _checkNodes() {
    const now = Date.now()
    let serverName

    for (serverName in this._nodes) {
      if (now - this._nodes[serverName].lastStatusTime > this._options.clusterNodeInactiveTimeout) {
        this._removeNode(serverName)
      }
    }
  }

  /**
   * Updates the status of a node with incoming status data and resets its lastStatusTime.
   *
   * If the remote node doesn't exist yet, it is added and an add event is emitted / logged
   *
   * @param   {Object} data node status data as generated by _publishStatus
   *
   * @private
   * @returns {void}
   */
  _updateNode(data) {
    const isNew = !this._nodes[data.serverName]
    this._nodes[data.serverName] = data
    this._nodes[data.serverName].lastStatusTime = Date.now()
    if (isNew) {
      this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.CLUSTER_JOIN, data.serverName)
      this.emit('add', data.serverName)
    }
  }

  /**
   * Removes a remote node from this registry if it exists.
   *
   * Logs/emits remove
   *
   * @param   {String} serverName
   *
   * @private
   * @returns {void}
   */
  _removeNode(serverName) {
    if (this._nodes[serverName]) {
      delete this._nodes[serverName]
      this._options.logger.log(C.LOG_LEVEL.INFO, C.EVENT.CLUSTER_LEAVE, serverName)
      this.emit('remove', serverName)
    }
  }

  /**
   * Publishes this node's status on the message bus
   *
   * @private
   * @returns {void}
   */
  _publishStatus() {
    this._inCluster = true
    const memoryStats = process.memoryUsage()

    const data = {
      serverName: this._options.serverName,
      connections: this._connectionEndpoint.getConnectionCount(),
      memory: memoryStats.heapUsed / memoryStats.heapTotal,
      leaderScore: this._leaderScore,
      externalUrl: this._options.externalUrl
    }

    this._updateNode(data)

    this._options.messageConnector.publish(C.TOPIC.CLUSTER, {
      topic: C.TOPIC.CLUSTER,
      action: C.ACTIONS.STATUS,
      data: [data]
    })
  }
}
