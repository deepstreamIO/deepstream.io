'use strict'

const DeepstreamServer = require('../../src/deepstream.io')

const util = require('util')
const EventEmitter = require('events').EventEmitter
const Logger = require('./test-logger')

let ports

const Cluster = function (wsPorts, enableLogging) {
  ports = wsPorts
  this._ports = wsPorts
  this._enableLogging = enableLogging
  this.servers = {}
  ports.forEach(this._startServer.bind(this))
}
util.inherits(Cluster, EventEmitter)

Cluster.prototype.getUrl = function (serverId) {
  return `localhost:${ports[serverId]}`
}

Cluster.prototype.updatePermissions = function (type) {
  for (const serverName in this.servers) {
    this.servers[serverName]._options.permissionHandler.loadConfig(`./test-e2e/config/permissions-${type}.json`)
  }
}

Cluster.prototype.stopServer = function (serverNumber, done) {
  const server = this.servers[Object.keys(this.servers)[serverNumber]]
  server.on('stopped', () => {
    setTimeout(done, 1000)
  })
  server.stop()
}

Cluster.prototype.startServer = function (serverNumber, done) {
  const serverPort = Object.keys(this.servers)[serverNumber]
  this._startServer(serverPort, () => {
    setTimeout(done, 1000)
  })
}

Cluster.prototype.stop = function () {
  for (const port in this.servers) {
    try {
      this.servers[port].stop()
    } catch (e) {
      console.log('couldn\'t stop server', port, 'in teardown', e)
    }
  }
}

Cluster.prototype._startServer = function (port, done) {
  this.servers[port] = new DeepstreamServer({
    port,
    serverName : `server-${port}`,

    stateReconciliationTimeout : 100,
    clusterKeepAliveInterval   : 100,
    clusterActiveCheckInterval : 100,
    clusterNodeInactiveTimeout : 200,
    lockTimeout                : 1000,
    shuffleListenProviders     : false,
    rpcTimeout: 30,

    showLogo : false,
    stopped  : this._checkStopped.bind(this),

    plugins : {
      message : {
        name    : 'redis',
        options : {
          host   : process.env.REDIS_HOST || 'localhost',
          port   : process.env.REDIS_PORT || 6379
        }
      }
    },

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
  if (done instanceof Function) {
    this.servers[port].on('started', done)
  } else {
    this.servers[port].on('started', this._checkReady.bind(this, port))
  }

  if (this._enableLogging !== true) {
    this.servers[port].set('logger', new Logger())
  }

  this.servers[port].on('stopped', this._checkStopped.bind(this))
  this.servers[port].start()
}

Cluster.prototype._checkReady = function () {
  for (const port in this.servers) {
    if (this.servers[port].isRunning() !== true) {
      return
    }
  }
  setTimeout(() => {
    this.emit('ready')
  }, 500)
}

Cluster.prototype._checkStopped = function () {
  for (const port in this.servers) {
    if (this.servers[port].isRunning() === true) {
      return
    }
  }
  this.emit('stopped')
}

module.exports = Cluster
