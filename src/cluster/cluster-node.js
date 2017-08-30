'use strict'
/* eslint-disable class-methods-use-this */

const net = require('net')

const IncomingConnection = require('./messaging/incoming-connection')
const OutgoingConnection = require('./messaging/outgoing-connection')
const utils = require('../utils/utils')
const StateRegistry = require('./distributed-state-registry')
const C = require('../constants/constants')
const EventEmitter = require('events').EventEmitter

const GLOBAL_STATES = 'GLOBAL_STATES'

const STATE = {
  INIT: 0,
  DISCOVERY: 1,
  BROADCAST: 2,
  LISTEN: 3,
  CLOSED: 4,
  ERROR: 5
}

const STATE_LOOKUP = utils.reverseMap(STATE)

class ClusterNode {
  constructor (options) {
    this._serverName = options.serverName
    this._logger = options.logger
    this._options = options

    const config = this._config = options.messageConnector
    config.serverName = this._config.serverName = options.serverName

    if (typeof config.seedNodes === 'string') {
      this._seedNodes = config.seedNodes.split(',')
    } else if (Array.isArray(config.seedNodes)) {
      this._seedNodes = config.seedNodes
    } else {
      this._seedNodes = []
    }
    this._url = `${config.host}:${config.port}`
    this._maxConnections = config.maxConnections

    this._tcpServer = net.createServer(this._onIncomingConnection.bind(this))
    this._tcpServer.listen(config.port, config.host, this._onReady.bind(this))

    this._connections = new Set()
    this._knownPeers = new Map() // serverName -> connection
    this._knownUrls = new Set()
    this._subscriptions = new Map() // topic -> [callback, ...]

    this._globalStateRegistry = new StateRegistry(GLOBAL_STATES, this._options, this, true)
    this._globalStateRegistry.on('server-added', (stateRegistryTopic, serverName) => {
      if (serverName === this._serverName) return
      this._emitter.emit(`ssra_${stateRegistryTopic}`, serverName)
    })
    this._globalStateRegistry.on('server-removed', (stateRegistryTopic, serverName) => {
      if (serverName === this._serverName) return
      this._emitter.emit(`ssrr_${stateRegistryTopic}`, serverName)
    })

    this._stateRegistries = new Map() // topic -> StateRegistry

    this._state = STATE.INIT
    if (this._options.electionNumber) {
      this._electionNumber = this._options.electionNumber
    } else {
      this._electionNumber = Math.random()
    }
    this._leader = null
    this._decideLeader()

    this._emitter = new EventEmitter()
  }

  sendDirect (serverName, topic, message) {
    const connection = this._getKnownPeer(serverName)
    if (connection) {
      connection.send(topic, message.action, message.data)
    }
  }

  _getKnownPeer (serverName) {
    const connection = this._knownPeers.get(serverName)
    if (!connection) {
      const error = `tried to find unknown server ${serverName} among peers of ${this._serverName}`
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INVALID_MSGBUS_MESSAGE, error)
    }
    return connection
  }

  /*
   * Prepare and send a message corresponding to the state registry
   */
  _sendStateMessage (connection, registryTopic, message) {
    const msg = message.data !== undefined ? [registryTopic, message.data] : [registryTopic]
    connection.send(C.TOPIC.STATE_REGISTRY, message.action, msg)
  }

  /*
   * Send a state update to a named peer
   */
  sendStateDirect (serverName, registryTopic, message) {
    const connection = this._getKnownPeer(serverName)
    if (connection) {
      this._sendStateMessage(connection, registryTopic, message)
    }
  }

  /*
   * Broadcast a state update to all peers
   */
  sendState (registryTopic, message) {
    if (registryTopic === GLOBAL_STATES) {
      for (const connection of this._knownPeers.values()) {
        this._sendStateMessage(connection, registryTopic, message)
      }
      return
    }
    const serverNames = this._globalStateRegistry.getAllServers(registryTopic)
    for (let i = 0; i < serverNames.length; i++) {
      if (serverNames[i] !== this._serverName) {
        const connection = this._getKnownPeer(serverNames[i])
        if (connection) {
          this._sendStateMessage(connection, registryTopic, message)
        }
      }
    }
  }

  send (topic, message) {
    const stateRegistry = this._stateRegistries.get(`${topic}_SUB`)
    const name = message.action !== C.ACTIONS.ACK ? message.data[0] : message.data[1]
    const serverNames = stateRegistry.getAllServers(name)
    for (let i = 0; i < serverNames.length; i++) {
      if (serverNames[i] !== this._serverName) {
        this.sendDirect(serverNames[i], topic, message)
      }
    }
  }

  subscribe (topic, callback) {
    this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, `new subscription to topic ${topic}`)
    const subscriptionsToTopic = this._subscriptions.get(topic)
    if (!subscriptionsToTopic) {
      this._subscriptions.set(topic, [callback])
    } else {
      subscriptionsToTopic.push(callback)
    }
  }

  isLeader () {
    return this._leader === this._serverName
  }

  getCurrentLeader () {
    return this._leader
  }

  getStateRegistry (name) {
    let registry = this._stateRegistries.get(name)
    if (!registry) {
      registry = new StateRegistry(name, this._options, this)
      this._emitter.on(`ssra_${name}`, registry.onServerAdded.bind(registry))
      this._emitter.on(`ssrr_${name}`, registry.onServerRemoved.bind(registry))
      this._globalStateRegistry.add(name)
      this._stateRegistries.set(name, registry)
    }
    return registry
  }

  _stateTransition (nextState) {
    {
      const current = STATE_LOOKUP[this._state]
      const next = STATE_LOOKUP[nextState]
      this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, `<><> Node state transition ${current} -> ${next} <><>`)
    }
    if (this._state !== STATE.ERROR) {
      this._state = nextState
    }
  }

  _onReady () {
    const error = `P2P Message Connector listening at ${this._config.host}:${this._config.port}`
    this._logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, error)
    for (let i = 0; i < this._seedNodes.length; i++) {
      this._probeHost(this._seedNodes[i])
    }
  }

  _probeHost (nodeUrl) {
    if (this._url === nodeUrl || this._knownUrls.has(nodeUrl)) {
      return
    }
    if (typeof nodeUrl !== 'string') {
      throw new Error(`Invalid node url ${nodeUrl}: must be a string e.g. "localhost:9089"`)
    }
    const parts = nodeUrl.split(':')
    if (parts.length !== 2) {
      throw new Error(`Invalid node url ${nodeUrl}: must have a host and port e.g. "localhost:9089"`)
    }
    const connection = new OutgoingConnection(nodeUrl, this._config, this._logger)
    this._addConnection(connection)
    connection.on('error', this._onConnectionError.bind(this, connection))
    connection.on('rejection', (event, message) => {
      if (event === C.EVENT.CONNECTION_LIMIT_EXCEEDED) {
        if (this._state === STATE.ERROR) {
          return
        }
        let errMsg = connection.remoteName ? `Server ${connection.remoteName}` : 'A server'
        errMsg += ` reached its cluster connection limit (${message} connections)!`
        this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.CONNECTION_LIMIT_EXCEEDED, errMsg)
        this._stateTransition(STATE.ERROR)
        return
      }
      this._logger.log(C.LOG_LEVEL.WARN, event, message)
    })
    connection.on('connect', () => {
      connection.sendWho({
        id: this._serverName,
        url: this._url,
        electionNumber: this._electionNumber
      })
    })

    connection.on('iam', (message) => {
      if (!message.id || !message.peers || message.electionNumber === undefined) {
        const error = `malformed IAM message ${JSON.stringify(message)}`
        this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.INVALID_MSGBUS_MESSAGE, error)
        // TODO: send error
        return
      }
      connection.setRemoteDetails(message.id, message.electionNumber)
      if (this._knownPeers.has(connection.remoteName)) {
        // this peer was already known to us, but responded to our identification message
        // TODO: warn, reject with reason
        this._removeConnection(connection)
        const error = 'received IAM from an outbound connection to a known peer'
        this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.UNSOLICITED_MSGBUS_MESSAGE, error)
      } else {
        const peerWasAdded = this._addPeer(connection)
        if (peerWasAdded) {
          for (const url of message.peers) {
            this._probeHost(url)
          }
        }
      }
      this._checkReady()
    })
  }

  _checkReady () {
    for (const connection of this._connections) {
      if (!connection.isIdentified()) {
        return
      }
    }
    this._stateTransition(STATE.BROADCAST)
    this._startBroadcast()
  }

  _startBroadcast () {
    for (const connection of this._connections) {
      connection.sendKnown({
        peers: this._getPeers()
      })
    }
    this._stateTransition(STATE.LISTEN)
  }

  _addPeer (connection) {
    if (!connection.remoteName || !connection.remoteUrl) {
      throw new Error('tried to add uninitialized peer')
    }
    if (this._knownPeers.size >= this._maxConnections - 1) {
      connection.sendReject(C.EVENT.CONNECTION_LIMIT_EXCEEDED, this._maxConnections)
      return false
    }
    connection.on('message', this._onMessage.bind(this, connection))
    this._knownPeers.set(connection.remoteName, connection)
    this._knownUrls.add(connection.remoteUrl)
    this._decideLeader()

    process.nextTick(() => this._globalStateRegistry.onServerAdded(connection.remoteName))
    return true
  }

  _removePeer (connection) {
    this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, `peer removed ${connection.remoteUrl}/${connection.remoteName}`)
    if (!connection.remoteName || !connection.remoteUrl) {
      throw new Error('tried to remove uninitialized peer')
    }
    connection.removeAllListeners('message')
    this._knownPeers.delete(connection.remoteName)
    this._knownUrls.delete(connection.remoteUrl)
    this._decideLeader()

    this._globalStateRegistry.onServerRemoved(connection.remoteName)
  }

  _decideLeader () {
    let leader = this._serverName
    let leaderNumber = this._electionNumber
    for (const connection of this._knownPeers.values()) {
      if (connection.electionNumber > leaderNumber) {
        leader = connection.remoteName
        leaderNumber = connection.electionNumber
      }
    }
    if (leader !== this._leader) {
      this._logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, `New cluster leader ${leader}`)
    }
    this._leader = leader
  }

  _onIncomingConnection (socket) {
    const connection = new IncomingConnection(socket, this._config, this._logger)
    connection.on('error', this._onConnectionError.bind(this, connection))
    connection.on('who', (message) => {
      if (!message.id || !message.url || !message.electionNumber) {
        const error = `malformed WHO message '${JSON.stringify(message)}'`
        this._logger.log(C.LOG_LEVEL.ERROR, C.EVENT.UNSOLICITED_MSGBUS_MESSAGE, error)
        // send error
        return
      }
      connection.setRemoteDetails(message.id, message.electionNumber, message.url)
      if (this._knownPeers.has(connection.remoteName)) {
        // I'm already connected to this peer, probably through an outbound connection, reject
        // TODO: the following line causes 'tried to send message to unknown server' errors in e2e
        // tests, investigate :)
        // connection.sendRejectDuplicate()
        const error = 'received inbound connection from peer that was already known'
        this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.UNSOLICITED_MSGBUS_MESSAGE, error)
        return
      }

      const peerWasAdded = this._addPeer(connection)
      if (peerWasAdded) {
        connection.sendIAm({
          id: this._serverName,
          peers: this._getPeers(),
          electionNumber: this._electionNumber
        })
      }
    })
    connection.on('known', (message) => {
      if (!message.peers || message.peers.constructor !== Array) {
        const error = `malformed known message ${JSON.stringify(message)}`
        this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INFO, error)
        // send error
        return
      }

      for (const url of message.peers) {
        this._probeHost(url)
      }

      this._checkReady()
    })
    this._addConnection(connection)
    const error = `new incoming connection from socket ${JSON.stringify(connection._socket.address())}`
    this._logger.log(C.LOG_LEVEL.DEBUG, C.EVENT.INFO, error)
  }

  _getPeers () {
    return Array.from(this._knownUrls)
  }

  _addConnection (connection) {
    connection.once('close', this._removeConnection.bind(this, connection))

    this._connections.add(connection)
  }

  _removeConnection (connection) {
    this._connections.delete(connection)
    if (this._knownPeers.has(connection.remoteName)) {
      this._removePeer(connection)
    }
  }

  _onConnectionError (connection, error) {
    this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INFO, `connection error: ${error.toString()}`)
  }

  _onMessage (connection, topic, message) {
    let modifiedTopic = topic
    if (topic === C.TOPIC.STATE_REGISTRY) {
      modifiedTopic = message.data[0]
      message.data = message.data[1]
    }
    const listeners = this._subscriptions.get(modifiedTopic)
    if (!listeners || listeners.length === 0) {
      const warnMsg = `message on unknown topic ${modifiedTopic}: ${JSON.stringify(message)}`
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNSOLICITED_MSGBUS_MESSAGE, warnMsg)
      return
    }
    for (let i = 0; i < listeners.length; i++) {
      listeners[i](message, connection.remoteName)
    }
  }

  close (callback) {
    if (this._connections.size === 0) {
      this._tcpServer.close(callback)
      return
    }
    utils.combineEvents(
      Array.from(this._connections),
      'close',
      () => this._tcpServer.close(callback)
    )
    this._connections.forEach(connection => connection.close())
  }
}

module.exports = ClusterNode
