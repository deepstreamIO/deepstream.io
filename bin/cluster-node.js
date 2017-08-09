'use strict'
/* eslint-disable class-methods-use-this */

const net = require('net')

const IncomingConnection = require('../src/cluster/incoming-connection')
const OutgoingConnection = require('../src/cluster/outgoing-connection')
const utils = require('../src/utils/utils')

const STATE = {
  INIT: 0,
  DISCOVERY: 1,
  BROADCAST: 2,
  LISTEN: 2,
  CLOSED: 3
}

const STATE_LOOKUP = utils.reverseMap(STATE)

class ClusterNode {
  constructor (config) {
    this._config = config
    this._seedNodes = config.seedNodes
    this._serverName = config.serverName
    this._url = `${config.host}:${config.port}`

    this._tcpServer = net.createServer(this._onIncomingConnection.bind(this))
    this._tcpServer.listen(config.port, config.host, this._onReady.bind(this))

    this._connections = new Set()
    // serverName -> connection
    this._knownPeers = new Map()
    this._knownUrls = new Set()

    this._state = STATE.INIT
    this._leaderNumber = Math.random()
  }

  _stateTransition (nextState) {
    {
      const current = STATE_LOOKUP[this._state]
      const next = STATE_LOOKUP[nextState]
      console.log(`node state transition ${current} -> ${next}`)
    }
    this._state = nextState
  }

  _onReady () {
    console.log('server ready')
    for (let i = 0; i < this._seedNodes.length; i++) {
      this._probeHost(this._seedNodes[i])
    }
  }

  _probeHost (nodeUrl) {
    if (this._url === nodeUrl || this._knownUrls.has(nodeUrl)) {
      return
    }
    const parts = nodeUrl.split(':')
    if (parts.length !== 2) {
      throw new Error(`Invalid node url ${nodeUrl}, must have a host and port e.g. '0.0.0.0:9089'`)
    }
    const connection = new OutgoingConnection(nodeUrl, this._config)
    connection.on('error', this._onConnectionError.bind(this, connection))
    connection.on('connect', () => {
      this._addConnection.bind(this, connection)
      connection.sendWho({
        id: this._serverName,
        url: this._url
      })
    })

    connection.on('iam', (message) => {
      if (!message.id || !message.peers || message.leaderNumber === undefined) {
        console.error('malformed iam message', message)
        // TODO: send error
        return
      }
      connection.remoteName = message.id
      if (this._knownPeers.has(connection.remoteName)) {
        // this peer was already known to us, but responded to our identification message
        // TODO: warn, reject with reason
        console.error('an outbound connection to a known peer identified')
        return
      }
      this._addPeer(connection)
      for (const url of message.peers) {
        this._probeHost(url)
      }
      this._checkReady()
    })
  }

  _checkReady () {
    for (const connection of this._connections) {
      if (!connection.isStable()) {
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
  }

  _addPeer (connection) {
    if (!connection.remoteName || !connection.remoteUrl) {
      throw new Error('tried to add uninitialized peer')
    }
    this._knownPeers.set(connection.remoteName, connection)
    this._knownUrls.add(connection.remoteUrl)
  }

  _removePeer (connection) {
    if (!connection.remoteName || !connection.remoteUrl) {
      throw new Error('tried to remove uninitialized peer')
    }
    this._knownPeers.delete(connection.remoteName)
    this._knownUrls.delete(connection.remoteUrl)
  }

  _onIncomingConnection (socket) {
    const connection = new IncomingConnection(socket, this._config)
    connection.on('error', this._onConnectionError.bind(this, connection))
    connection.on('who', (message) => {
      if (!message.id || !message.url) {
        console.error('malformed message', message, message.id, message.url)
        // send error
        return
      }
      connection.remoteName = message.id
      connection.remoteUrl = message.url
      if (this._knownPeers.has(connection.remoteName)) {
        // I'm already connected to this peer, probably through an outbound connection, reject
        // TODO: reject
        console.error('received inbound connection from peer that was already known')
        return
      }

      connection.sendIAm({
        id: this._serverName,
        peers: this._getPeers(),
        leaderNumber: this._leaderNumber
      })

      this._addPeer(connection)
    })
    connection.on('known', (message) => {
      if (!message.peers) {
        // send error
        return
      }
      // const peers = message.peers
    })
    this._addConnection(connection)
    console.log('new incoming connection from socket', connection.remoteUrl)
  }

  _getPeers () {
    return Array.from(this._knownUrls)
  }

  _addConnection (connection) {
    connection.once('close', this._removeConnection.bind(this, connection))
    connection.on('message', this._onMessage.bind(this, connection))

    this._connections.add(connection)
  }

  _removeConnection (connection) {
    this._connections.delete(connection)
    if (this._knownPeers.has(connection.serverName)) {
      this._removePeer(connection)
    }
  }

  _onConnectionError (connection, error) {
    console.error('connection error', error)
  }

  _onMessage (connection, topic, message) {
    console.log('onmessage', topic, message)
  }

  close () {
    this._tcpServer.close(() => {})
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
    serverName: Math.random()
  }
  console.log(config)
  const node = new ClusterNode(config)
  process.on('SIGINT', () => node.close())
}
