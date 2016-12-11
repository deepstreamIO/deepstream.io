'use strict'

const C = require('../constants/constants')

const EventEmitter = require('events').EventEmitter
const DATA_LENGTH = {}

DATA_LENGTH[C.EVENT.DISTRIBUTED_STATE_REQUEST_FULL_STATE] = 1
DATA_LENGTH[C.EVENT.DISTRIBUTED_STATE_FULL_STATE] = 2
DATA_LENGTH[C.EVENT.DISTRIBUTED_STATE_ADD] = 3
DATA_LENGTH[C.EVENT.DISTRIBUTED_STATE_REMOVE] = 3

/**
 * This class provides a generic mechanism that allows to maintain
 * a distributed state amongst the nodes of a cluster. The state is an
 * array of unique strings in arbitrary order.
 *
 * Whenever a string is added by any node within the cluster for the first time,
 * an 'add' event is emitted. Whenever its removed by the last node within the cluster,
 * a 'remove' event is emitted.
 *
 * @extends {EventEmitter}
 *
 * @event 'add' emitted whenever an entry is added for the first time
 * @event 'remove' emitted whenever an entry is removed by the last node
 *
 * @author DeepstreamHub GmbH 2016
 */
module.exports = class DistributedStateRegistry extends EventEmitter {

  /**
  * Initialises the DistributedStateRegistry and subscribes to the provided cluster topic
  *
  * @param   {String} topic   A TOPIC constant
  * @param   {Object} options Global deepstream server options
  *
  * @constructor
  */
  constructor(topic, options) {
    super()
    this._topic = topic
    this._options = options
    this._options.messageConnector.subscribe(topic, this._processIncomingMessage.bind(this))
    this._options.clusterRegistry.on('remove', this.removeAll.bind(this))
    this._data = {}
    this._reconciliationTimeouts = {}
    this._fullStateSent = false
    this._requestFullState(C.ALL)
  }

  /**
  * Checks if a given entry exists within the registry
  *
  * @param   {String}  name       the name of the entry
  *
  * @public
  * @returns {Boolean} exists
  */
  has(name) {
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
  add(name) {
    if (!this._has(name, this._options.serverName)) {
      this._add(name, this._options.serverName)
      this._sendMessage(name, C.EVENT.DISTRIBUTED_STATE_ADD)
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
  remove(name) {
    if (this._has(name, this._options.serverName)) {
      this._remove(name, this._options.serverName)
      this._sendMessage(name, C.EVENT.DISTRIBUTED_STATE_REMOVE)
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
  removeAll(serverName) {
    let name
    for (name in this._data) {
      if (this._data[name].nodes[serverName]) {
        this._remove(name, serverName)
      }
    }
  }

  /**
  * Returns all the servers that hold a given state
  *
  * @public
  * @returns {Object} entries
  */
  getAllServers(name) {
    if (this._data[name]) {
      return Object.keys(this._data[name].nodes)
    }

    return []
  }

  /**
  * Returns all currently registered entries
  *
  * @public
  * @returns {Array} entries
  */
  getAll() {
    return Object.keys(this._data)
  }

  /**
  * Removes an entry for a given serverName. If the serverName
  * was the last node that held the entry, the entire entry will
  * be removed and a `remove` event will be emitted
  *
  * @param   {String} name       the name of the entry
  * @param   {String} serverName the name of the server that no longer holds the entry
  *
  * @private
  * @returns {void}
  */
  _remove(name, serverName) {
    let exists = false

    if (!this._data[name]) {
      return
    }

    delete this._data[name].nodes[serverName]

    for (const nodeName in this._data[name].nodes) {
      if (this._data[name].nodes[nodeName] === true) {
        exists = true
      }
    }

    if (exists === false) {
      delete this._data[name]
      this.emit('remove', name)
    }
  }

  /**
  * Adds a new entry to this registry, either as a result of a remote or
  * a local addition. Will emit an `add` event if the entry wasn't present before
  *
  * @param {String} name       the name of the new entry
  * @param {String} serverName the name of the server that added the entry
  *
  * @private
  * @returns {void}
  */
  _add(name, serverName) {
    if (!this._data[name]) {
      this._data[name] = {
        nodes: {},
        checkSum: this._createCheckSum(name)
      }
      this.emit('add', name)
    }

    this._data[name].nodes[serverName] = true
  }

  /**
  * Checks if a given entry exists for a given serverName
  *
  * @param   {String}  name       the name of the entry
  * @param   {String}  serverName the name of the server that might hold the entry
  *
  * @private
  * @returns {Boolean} exists
  */
  _has(name, serverName) {
    return this._data[name] && this._data[name].nodes[serverName]
  }

  /**
  * Generic messaging function for add and remove messages
  *
  * @param   {String} name   the name of the entry that's added or removed
  * @param   {String} action action-constant, one of C.EVENT.<>
  *
  * @private
  * @returns {void}
  */
  _sendMessage(name, action) {
    const message = {
      topic: this._topic,
      action,
      data: [name, this._options.serverName, this._getCheckSumTotal(this._options.serverName)]
    }

    this._options.messageConnector.publish(this._topic, message)
  }

  /**
  * This method calculates the total checkSum for all local entries of
  * a given serverName
  *
  * @param {String} serverName the name of the server for which the checkSum should be calculated
  *
  * @private
  * @returns {Number} totalCheckSum
  */
  _getCheckSumTotal(serverName) {
    let totalCheckSum = 0
    let name

    for (name in this._data) {
      if (this._data[name].nodes[serverName]) {
        totalCheckSum += this._data[name].checkSum
      }
    }

    return totalCheckSum
  }

  /**
  * Calculates a simple checkSum for a given name. This is done up-front and cached
  * to increase performance for local add and remove operations. Arguably this is a generic
  * method and might be moved to the utils class if we find another usecase for it.
  *
  * @param   {String} name the name of the entry
  *
  * @private
  * @returns {Number} checkSum
  */
  _createCheckSum(name) {
    let checkSum = 0
    let i

    for (i = 0; i < name.length; i++) {
      checkSum = ((checkSum << 5) - checkSum) + name.charCodeAt(i)
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
  *
  * @param   {String} serverName     the name of the remote server for which the checkSum should be calculated
  * @param   {Number} remoteCheckSum The checksum the remote server has calculated for all its local entries
  *
  * @private
  * @returns {void}
  */
  _verifyCheckSum(serverName, remoteCheckSum) {
    if (this._getCheckSumTotal(serverName) !== remoteCheckSum) {
      this._reconciliationTimeouts[serverName] = setTimeout(
                this._requestFullState.bind(this, serverName),
                this._options.stateReconciliationTimeout
            )
    } else if (this._reconciliationTimeouts[serverName]) {
      clearTimeout(this._reconciliationTimeouts[serverName])
      delete this._reconciliationTimeouts[serverName]
    }
  }

  /**
  * Sends a reconciliation request for a server with a given name (technically, its send to
  * every node within the cluster, but will be ignored by all but the one with a matching name)
  *
  * The matching node will respond with a DISTRIBUTED_STATE_FULL_STATE message
  *
  * @param   {String} serverName The name of the node with the compromised state
  *
  * @private
  * @returns {void}
  */
  _requestFullState(serverName) {
    this._options.messageConnector.publish(this._topic, {
      topic: this._topic,
      action: C.EVENT.DISTRIBUTED_STATE_REQUEST_FULL_STATE,
      data: [serverName]
    })
  }

  /**
  * Creates a full state message containing an array of all local entries that
  * will be used to reconcile compromised states as well as provide the full state
  * for new nodes that joined the cluster
  *
  * When a state gets compromised, more than one remote registry might request a full state update.
  * This method will  schedule a timeout in which no additional full state messages are sent to make sure
  * only a single full state message is sent in reply.
  *
  * @private
  * @returns {void}
  */
  _sendFullState() {
    const localState = []
    let name

    for (name in this._data) {
      if (this._data[name].nodes[this._options.serverName]) {
        localState.push(name)
      }
    }

    this._options.messageConnector.publish(this._topic, {
      topic: this._topic,
      action: C.EVENT.DISTRIBUTED_STATE_FULL_STATE,
      data: [this._options.serverName, localState]
    })

    this._fullStateSent = true
    setTimeout(this._resetFullStateSent.bind(this), this._options.stateReconciliationTimeout)
  }

  /**
  * This will apply the data from an incoming full state message. Entries that are not within
  * the incoming array will be removed for that node from the local registry and new entries will
  * be added.
  *
  * @param   {String} serverName the name of the server that send the full state message
  * @param   {Array}  names      a full list of all local entries of that server in arbitrary order
  *
  * @private
  * @returns {void}
  */
  _applyFullState(serverName, names) {
    let name
    let i

    for (name in this._data) {
            // please note: only checking if the name exists is sufficient as the registry will just
            // set node[serverName] to false if the entry exists, but not for the remote server.
      if (names.indexOf(name) === -1) {
        this._remove(name, serverName)
      }
    }

    for (i = 0; i < names.length; i++) {
      this._add(names[i], serverName)
    }
  }

  /**
  * Will be called after a full state message has been sent and
  * stateReconciliationTimeout has passed. This will allow further reconciliation
  * messages to be sent again.
  *
  * @private
  * @returns {void}
  */
  _resetFullStateSent() {
    this._fullStateSent = false
  }

  /**
  * This is the main routing point for messages coming in from
  * the message connector.
  *
  * @param   {Object} message a message connector message with topic, action and data fields
  *
  * @private
  * @returns {void}
  */
  _processIncomingMessage(message) {
    if (!this._isValidMessage(message)) {
      return
    }

    if (message.action === C.EVENT.DISTRIBUTED_STATE_ADD) {
      this._add(message.data[0], message.data[1])
      this._verifyCheckSum(message.data[1], message.data[2])
    } else if (message.action === C.EVENT.DISTRIBUTED_STATE_REMOVE) {
      this._remove(message.data[0], message.data[1])
      this._verifyCheckSum(message.data[1], message.data[2])
    } else if (message.action === C.EVENT.DISTRIBUTED_STATE_REQUEST_FULL_STATE) {
      if (message.data[0] === C.ALL || (message.data[0] === this._options.serverName && this._fullStateSent === false)) {
        this._sendFullState()
      }
    } else if (message.action === C.EVENT.DISTRIBUTED_STATE_FULL_STATE) {
      this._applyFullState(message.data[0], message.data[1])
    }
  }

  /**
  * Performs basic validations for incoming messages, based on action and data-length
  *
  * @param   {Object} message a message connector message with topic, action and data fields
  *
  * @private
  * @returns {Boolean} isValid
  */
  _isValidMessage(message) {
    if (DATA_LENGTH[message.action] === undefined) {
      this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNKNOWN_ACTION, message.action)
      return false
    }

    if (message.data.length !== DATA_LENGTH[message.action]) {
      this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.INVALID_MESSAGE_DATA, message.data)
      return false
    }

    return true
  }
}
