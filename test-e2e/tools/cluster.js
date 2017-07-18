'use strict'

const DeepstreamServer = require('../../src/deepstream.io')

const util = require('util')
const EventEmitter = require('events').EventEmitter
const Logger = require('./test-logger')

const Cluster = function (port, enableLogging) {
  this._port = port
  this._server = null
  this._enableLogging = enableLogging
  this.started = false
  this._startServer()
}
util.inherits(Cluster, EventEmitter)

Cluster.prototype.getUrl = function () {
  return `localhost:${this._port}`
}

Cluster.prototype.updatePermissions = function (type) {
  this._server._options.permissionHandler.loadConfig(`./test-e2e/config/permissions-${type}.json`)
}

Cluster.prototype.start = function () {
  if (this.started) {
    this.emit('started')
    return
  }
  this.started = true
  this._startServer()
}

Cluster.prototype.stop = function () {
  if (!this.started) {
    this.emit('stopped')
    return
  }
  this.started = false
  this._server.stop()
}

Cluster.prototype._startServer = function () {
  this.started = true
  this._server = new DeepstreamServer({
    port: this._port,
    serverName : `server-${this._port}`,

    stateReconciliationTimeout : 100,
    lockTimeout                : 1000,
    shuffleListenProviders     : false,
    rpcTimeout: 30,

    showLogo : false,
    stopped  : () => setTimeout(() => this.emit('stopped'), 500),

    maxAuthAttempts              : 2,
    unauthenticatedClientTimeout : 200,
    auth : {
      type    : 'file',
      options : {
        path : './test-e2e/config/users.yml'
      }
    },
    permission: {
      type    : 'config',
      options : {
        path: './test-e2e/config/permissions.json'
      }
    }
  })

  if (this._enableLogging !== true) {
    this._server.set('logger', new Logger())
  }

  this._server.on('started', () => setTimeout(() => this.emit('started'), 500))
  this._server.on('stopped', () => setTimeout(() => this.emit('stopped'), 500))
  this._server.start()
}


module.exports = Cluster
