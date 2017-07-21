'use strict'

const DeepstreamServer = require('../../src/deepstream.io')

const util = require('util')
const EventEmitter = require('events').EventEmitter
const Logger = require('./test-logger')

const getUid = require('../../src/utils/utils').getUid

const Cluster = function (wsPort, httpPort, enableLogging) {
  this._wsPort = wsPort
  this._httpPort = httpPort
  this._server = null
  this._enableLogging = enableLogging
  this.started = false
  this._startServer()
}
util.inherits(Cluster, EventEmitter)

Cluster.prototype.getUrl = function () {
  return `localhost:${this._wsPort}`
}

Cluster.prototype.getHttpUrl = function () {
  return `localhost:${this._httpPort}`
}

Cluster.prototype.getAuthUrl = function () {
  return `localhost:${this._httpPort}/auth`
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
    serverName : `server-${this._wsPort}`,

    stateReconciliationTimeout : 100,
    lockTimeout                : 1000,
    shuffleListenProviders     : false,
    rpcTimeout: 30,

    showLogo : false,
    stopped  : () => setTimeout(() => this.emit('stopped'), 500),

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
          port: this._wsPort,
        }
      },
      http: {
        name: 'http',
        options: {
          port: this._httpPort,
          enableAuthEndpoint: true,
          authPath: '/auth',
          postPath: '/',
          getPath: '/',
          requestTimeout: 80
        }
      }
    },
  })

  const tokens = new Map()
  this._server.set('authenticationHandler', {
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
      const users = ['A', 'B', 'C', 'D', 'W']
      if (
        users.indexOf(authData.username) !== -1
        && authData.password === 'abcdefgh'
      ) {
        const token = getUid()
        tokens.set(token, authData.username)
        callback(true, { token, username: authData.username })
        return
      }
      if (authData.username === 'userA' && authData.password === 'abcdefgh') {
        callback(true, {})
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
      }
      callback(false)
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
