'use strict'

const DeepstreamServer = require('../../src/deepstream.io')

const EventEmitter = require('events').EventEmitter
const Logger = require('./test-logger')
const utils = require('../../src/utils/utils')

let ports

module.exports = class Cluster extends EventEmitter {
  constructor (wsPorts, enableLogging) {
    super()
    ports = wsPorts
    this._ports = wsPorts
    this._enableLogging = enableLogging
    this.servers = {}
    ports.forEach(this._startServer.bind(this))
  }

  getUrl (serverId) {
    return `localhost:${ports[serverId]}`
  }

  getHttpUrl (serverId) {
    return `localhost:${ports[serverId] + 200}/`
  }

  getAuthUrl (serverId) {
    return `localhost:${ports[serverId] + 200}/auth`
  }

  updatePermissions (type, done) {
    if (!(done instanceof Function)) {
      console.trace(done)
    }
    const permissionHandlers = Object.keys(this.servers)
      .map(serverName => this.servers[serverName]._options.permissionHandler)
    permissionHandlers.forEach(ph => ph.loadConfig(`./test-e2e/config/permissions-${type}.json`))
    utils.combineEvents(permissionHandlers, 'config-loaded', done)
  }

  stopServer (serverNumber, done) {
    const server = this.servers[Object.keys(this.servers)[serverNumber]]
    server.on('stopped', () => {
      setTimeout(done, 1000)
    })
    server.stop()
  }

  startServer (serverNumber, done) {
    const serverPort = Object.keys(this.servers)[serverNumber]
    this._startServer(serverPort, () => {
      setTimeout(done, 1000)
    })
  }

  stop () {
    for (const port in this.servers) {
      try {
        this.servers[port].stop()
      } catch (e) {
        console.log('couldn\'t stop server', port, 'in teardown', e)
      }
    }
  }

  _startServer (port, done) {
    this.started = true
    this.servers[port] = new DeepstreamServer({
      serverName : `server-${port}`,
      stateReconciliationTimeout : 100,
      clusterKeepAliveInterval   : 100,
      clusterActiveCheckInterval : 100,
      clusterNodeInactiveTimeout : 200,
      lockTimeout                : 1500,
      lockRequestTimeout         : 1500,
      shuffleListenProviders     : false,
      rpcTimeout: 30,

      showLogo : false,
      stopped  : this._checkStopped.bind(this),

      maxAuthAttempts              : 2,
      unauthenticatedClientTimeout : 200,
      permission: {
        type    : 'config',
        options : {
          path: './test-e2e/config/permissions-open.json'
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

      messageConnector: {
        host: 'localhost',
        port: Number(port) + 400,
        seedNodes: Object.keys(this.servers).map(p => `localhost:${Number(p) + 400}`),
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

  _checkReady () {
    for (const port in this.servers) {
      if (this.servers[port].isRunning() !== true) {
        return
      }
    }
    setTimeout(() => {
      this.emit('ready')
    }, 500)
  }

  _checkStopped () {
    for (const port in this.servers) {
      if (this.servers[port].isRunning() === true) {
        return
      }
    }
    this.emit('stopped')
  }
}
