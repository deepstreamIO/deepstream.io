'use strict'
/* eslint-disable class-methods-use-this */

const net = require('net')

const IncomingConnection = require('./incoming-connection')
const OutgoingConnection = require('./outgoing-connection')
const utils = require('../utils/utils')
const StateRegistry = require('./distributed-state-registry')
const C = require('../constants/constants')

const STATE = {
  INIT: 0,
  DISCOVERY: 1,
  BROADCAST: 2,
  LISTEN: 3,
  CLOSED: 4
}

const STATE_LOOKUP = utils.reverseMap(STATE)

class ClusterNode {
  constructor (options) {
    this._serverName = options.serverName
    this._logger = options.logger
    this._options = options

    const config = this._config = options.messageConnector
    this._seedNodes = config.seedNodes
    this._url = `${config.host}:${config.port}`

    this._tcpServer = net.createServer(this._onIncomingConnection.bind(this))
    this._tcpServer.listen(config.port, config.host, this._onReady.bind(this))

    this._connections = new Set()
    this._knownPeers = new Map() // serverName -> connection
    this._knownUrls = new Set()
    this._subscriptions = new Map() // topic -> [callback, ...]
    this._stateRegistries = new Map() // topic -> StateRegistry
    this._serverDisconnectListeners = []

    this._state = STATE.INIT
    this._electionNumber = Math.random()
    this._leader = null
    this._decideLeader()
  }

  sendDirect (serverName, topic, message) {
    const connection = this._knownPeers.get(serverName)
    if (!connection) {
      const error = `tried to send message to unknown server ${serverName}`
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.INVALID_MSGBUS_MESSAGE, error)
      return
    }
    connection.sendMessage({ topic, message })
  }

  send (topic, message) {
    this.sendBroadcast(topic, message)
  }

  sendBroadcast (topic, message) {
    for (const connection of this._knownPeers.values()) {
      connection.sendMessage({ topic, message })
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

  getAll () {
    return Array.from(this._knownPeers.keys())
  }

  subscribeServerDisconnect (callback) {
    this._serverDisconnectListeners.push(callback)
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
    this._state = nextState
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
        this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNSOLICITED_MSGBUS_MESSAGE, error)
      } else {
        this._addPeer(connection)
        for (const url of message.peers) {
          this._probeHost(url)
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
    connection.on('message', this._onMessage.bind(this, connection))
    this._knownPeers.set(connection.remoteName, connection)
    this._knownUrls.add(connection.remoteUrl)
    this._decideLeader()
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
    this._serverDisconnectListeners.forEach(callback => callback(connection.remoteName))
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
        const error = `malformed WHO message ${JSON.stringify(message)}`
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

      connection.sendIAm({
        id: this._serverName,
        peers: this._getPeers(),
        electionNumber: this._electionNumber
      })

      this._addPeer(connection)
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

  _onMessage (connection, data) {
    const topic = data.topic
    const message = data.message
    const listeners = this._subscriptions.get(topic)
    if (!listeners || listeners.length === 0) {
      this._logger.log(C.LOG_LEVEL.WARN, C.EVENT.UNSOLICITED_MSGBUS_MESSAGE, `message on unknown topic ${topic}: ${message}`)
      console.log(this._subscriptions.keys())
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

if (!module.parent) {
  console.log('command line mode')
  const config = {
    host: process.argv[2],
    port: process.argv[3],
    seedNodes: process.argv.slice(4),
    maxReconnectAttempts: 4,
    reconnectInterval: 1500,
    pingTimeout: 500,
    pingInterval: 1000,
  }
  console.log(config)
  const options = {
    messageConnector: config,
    logger: console,
    serverName: utils.getUid()
  }
  const node = new ClusterNode(options)
  process.on('SIGINT', () => node.close(() => {
    process.exit(0)
  }))
}

