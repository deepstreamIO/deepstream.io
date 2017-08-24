'use strict'

const C = require('../constants/constants')
const utils = require('../utils/utils')
const EventEmitter = require('events').EventEmitter

const SUPPORTED_ACTIONS = {}
SUPPORTED_ACTIONS[C.ACTIONS.LOCK_RESPONSE] = true
SUPPORTED_ACTIONS[C.ACTIONS.LOCK_REQUEST] = true
SUPPORTED_ACTIONS[C.ACTIONS.LOCK_RELEASE] = true

/**
 * The lock registry is responsible for maintaing a single source of truth
 * within the cluster, used mainly for issuing cluster wide locks when an operation
 * that stretches over multiple nodes are required.
 *
 * For example, distributed listening requires a leader to drive the nodes in sequence,
 * so issuing a lock prevents multiple nodes from assuming the lead.
 *
 */
module.exports = class LockRegistry {
  /**
  * The unique registry is a singleton and is only created once
  * within deepstream.io. It is passed via
  * via the options object.
  *
  * @param  {Object} options                     The options deepstream was created with
  * @param  {ClusterRegistry} clusterRegistry    The cluster registry, used to get the
  *                                              cluster leader
  *
  * @constructor
  */
  constructor (options, cluster) {
    this._options = options
    this._cluster = cluster
    this._locks = {}
    this._timeouts = {}
    this._responseEventEmitter = new EventEmitter()
    this._onPrivateMessageFn = this._onPrivateMessage.bind(this)
    this._cluster.subscribe(C.TOPIC.LEADER_PRIVATE, this._onPrivateMessageFn)
  }

  /**
  * Requests a lock, if the leader ( whether local or distributed ) has the lock availble
  * it will invoke the callback with true, otherwise false.
  *
  * @param  {String}   name     the lock name that is desired
  * @param  {Function} callback the callback to be told if the lock has been reserved succesfully
  *
  * @public
  * @returns {void}
  */
  get (name, callback) {
    const leaderServerName = this._cluster.getCurrentLeader()

    if (this._options.serverName === leaderServerName) {
      callback(this._getLock(name))
    } else if (!this._timeouts[name]) {
      this._getRemoteLock(name, leaderServerName, callback)
    } else {
      callback(false)
    }
  }

  /**
  * Release a lock, allowing other resources to request it again
  *
  * @param  {String}   name     the lock name that is desired
  *
  * @public
  * @returns {void}
  */
  release (name) {
    const leaderServerName = this._cluster.getCurrentLeader()

    if (this._options.serverName === leaderServerName) {
      this._releaseLock(name)
    } else {
      this._releaseRemoteLock(name, leaderServerName)
    }
  }

  /**
  * Called when the current node is not the leader, issuing a lock request
  * via the message bus
  *
  * @param  {String}   name             The lock name
  * @param  {String}   leaderServerName The leader of the cluster
  * @param  {Function} callback         The callback to invoke once a response
  *                                     from the server is retrieved
  * @private
  * @returns {void}
  */
  _getRemoteLock (name, leaderServerName, callback) {
    this._timeouts[name] = utils.setTimeout(
      this._onLockRequestTimeout.bind(this, name),
      this._options.lockRequestTimeout
    )

    this._responseEventEmitter.once(name, callback)

    this._cluster.sendStateDirect(leaderServerName, C.TOPIC.LEADER_PRIVATE, {
      topic: C.TOPIC.LEADER_PRIVATE,
      action: C.ACTIONS.LOCK_REQUEST,
      data: [{
        name,
        responseTopic: this._localTopic
      }]
    })
  }

  /**
  * Notifies a remote leader keeping a lock that said lock is no longer required
  *
  * @param  {String}   name             The lock name
  * @param  {String}   leaderServerName The leader of the cluster
  *
  * @private
  * @returns {void}
  */
  _releaseRemoteLock (name, leaderServerName) {
    this._cluster.sendStateDirect(leaderServerName, C.TOPIC.LEADER_PRIVATE, {
      topic:  C.TOPIC.LEADER_PRIVATE,
      action: C.ACTIONS.LOCK_RELEASE,
      data: [{
        name
      }]
    })
  }

  /**
  * Called when a message is recieved on the message bus.
  * This could mean the leader responded to a request or that you're currently
  * the leader and recieved a request.
  *
  * @param  {Object} message Object from message bus
  *
  * @private
  * @returns {void}
  */
  _onPrivateMessage (message, remoteServerName) {
    if (!SUPPORTED_ACTIONS[message.action]) {
      this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action)
      return
    }

    if (!message.data || !message.data[0]) {
      this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data)
      return
    }

    if (message.action === C.ACTIONS.LOCK_RESPONSE) {
      this._handleRemoteLockResponse(message.data[0])
      return
    }

    if (this._cluster.isLeader() === false) {
      this._options.logger.log(
        C.LOG_LEVEL.WARN,
        C.EVENT.INVALID_LEADER_REQUEST,
        `server ${remoteServerName} assumes this node '${this._options.serverName}' is the leader`
      )

      return
    }

    if (message.action === C.ACTIONS.LOCK_REQUEST) {
      this._handleRemoteLockRequest(message.data[0], remoteServerName)
    } else if (message.action === C.ACTIONS.LOCK_RELEASE) {
      this._releaseLock(message.data[0].name, remoteServerName)
    }
  }

  /**
  * Called when a remote lock request is received
  *
  * @param  {Object} data messageData
  *
  * @private
  * @returns {void}
  */
  _handleRemoteLockRequest (data, remoteServerName) {
    this._options.message.sendStateDirect(remoteServerName, C.TOPIC.LEADER_PRIVATE, {
      topic: data.responseTopic,
      action: C.ACTIONS.LOCK_RESPONSE,
      data: [{
        name: data.name,
        result: this._getLock(data.name)
      }]
    })
  }

  /**
  * Called when a remote lock response is received
  *
  * @param  {Object} data messageData
  *
  * @private
  * @returns {void}
  */
  _handleRemoteLockResponse (data) {
    clearTimeout(this._timeouts[data.name])
    delete this._timeouts[data.name]
    this._responseEventEmitter.emit(data.name, data.result)
  }

  /**
  * Returns true if reserving lock was possible otherwise returns false
  *
  * @param  {String}   name     Name of lock
  *
  * @private
  * @return {boolean}
  */
  _getLock (name) {
    if (this._locks[name] === true) {
      return false
    }

    this._timeouts[name] = utils.setTimeout(
      this._onLockTimeout.bind(this, name),
      this._options.lockTimeout
    )
    this._locks[name] = true
    return true
  }

  /**
  * Called when a lock is no longer required and can be released. This is triggered either by
  * a timeout if a remote release message wasn't received in time or when release was called
  * locally.
  *
  * Important note: Anyone can release a lock. It is assumed that the cluster is trusted
  * so maintaining who has the lock is not required. This may need to change going forward.
  *
  * @param  {String} name Lock name
  *
  * @private
  * @returns {void}
  */
  _releaseLock (name) {
    clearTimeout(this._timeouts[name])
    delete this._timeouts[name]
    delete this._locks[name]
  }

  /**
  * Called when a timeout occurs on a lock that has been reserved for too long
  *
  * @param  {String} name The lock name
  *
  * @private
  * @returns {void}
  */
  _onLockTimeout (name) {
    this._releaseLock(name)
    this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.TIMEOUT, `lock ${name} released due to timeout`)
  }

  /**
  * Called when a remote request has timed out, resulting in notifying the client that
  * the lock wasn't able to be reserved
  *
  * @param  {String} name The lock name
  *
  * @private
  * @returns {void}
  */
  _onLockRequestTimeout (name) {
    this._handleRemoteLockResponse({ name, result: false })
    this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.TIMEOUT, `request for lock ${name} timed out`)
  }
}
