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

Cluster.prototype.getHttpUrl = function (serverId) {
  return `localhost:${ports[serverId] + 200}/`
}

Cluster.prototype.getAuthUrl = function (serverId) {
  return `localhost:${ports[serverId] + 200}/auth`
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
  this.started = true
  this.servers[port] = new DeepstreamServer({
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
    permission: {
      type    : 'config',
      options : {
        path: './test-e2e/config/permissions.json'
      }
    },

    connectionEndpoints: {
      websocket: {
        name: 'uws',
        options: {
          port
        }
      },
      http: {
        name: 'http',
        options: {
          port: Number(port) + 200,
          host: '0.0.0.0',
          allowAuthData: true,
          enableAuthEndpoint: true,
          authPath: '/auth',
          postPath: '/',
          getPath: '/',
          healthCheckPath: '/health-check',
          allowAllOrigins: true
        }
      }
    },
  })
  if (done instanceof Function) {
    this.servers[port].on('started', done)
  } else {
    this.servers[port].on('started', this._checkReady.bind(this, port))
  }

  if (this._enableLogging !== true) {
    this.servers[port].set('logger', new Logger())
  }

  const tokens = new Map()
  this.servers[port].set('authenticationHandler', {
    isReady: true,
    isValidUser (headers, authData, callback) {
      if (authData.token) {
        // authenticate token
        const username = tokens.get(authData.token)
        if (username) {
          callback(true, { username })
          return
        }

        if (authData.token === 'letmein') {
          callback(true, { username: 'A' })
          return
        }
      }
      // authenicate auth data
      const users = ['A', 'B', 'C', 'D', 'W', '1', '2', '3', '4']
      if (
        users.indexOf(authData.username) !== -1
        && authData.password === 'abcdefgh'
      ) {
        const token = Math.random().toString()
        tokens.set(token, authData.username)
        callback(true, { token, username: authData.username })
        return
      }
      if (authData.username === 'userA' && authData.password === 'abcdefgh') {
        callback(true, { username: 'userA' })
        return
      }
      if (authData.username === 'userB' && authData.password === '123456789') {
        callback(true, {
          username: 'userB',
          clientData: {
            'favorite color': 'orange',
            id: 'userB'
          },
          serverData: {
            invalid: 'invalid'
          }
        })
        return
      }
      callback(false)
    }
  })

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
