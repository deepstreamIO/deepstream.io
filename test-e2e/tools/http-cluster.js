/* eslint-disable new-cap, class-methods-use-this */
'use strict'

const DeepstreamServer = require('../../../src/deepstream.io')
const dsUtils = require('../../../src/utils/utils')

const combineEvents = dsUtils.combineEvents
const getUid = dsUtils.getUid

const events = require('events')
const Logger = require('./test-logger')

module.exports = class Cluster extends events.EventEmitter {
  constructor (wsPorts, httpPorts, enableLogging) {
    super()
    this._ports = wsPorts.concat(httpPorts)
    this._enableLogging = enableLogging
    this.servers = {}
    for (let i = 0; i < wsPorts.length; i++) {
      this._startHTTPServer(wsPorts[i], httpPorts[i])
    }
  }

  getServerName (serverId) {
    return `server-${this._ports[serverId]}`
  }

  getUrl (serverId) {
    return `localhost:${this._ports[serverId]}`
  }

  getHttpUrl (serverId) {
    return `localhost:${this._ports[serverId]}/api/v1/`
  }

  getAuthUrl (serverId) {
    return `localhost:${this._ports[serverId]}/api/v1/auth`
  }

  updatePermissions (type, done) {
    const permissionHandlers = Object.keys(this.servers)
      .map(serverName => this.servers[serverName]._options.permissionHandler)
    const path = `node_modules/deepstream.io/test-e2e/config/permissions-${type}.json`
    permissionHandlers.forEach(handler => handler.loadConfig(path))
    combineEvents(permissionHandlers, 'config-loaded', done)
  }

  stopServer (serverNumber, done) {
    const server = this.servers[Object.keys(this.servers)[serverNumber]]
    if (!server.isRunning()) {
      return
    }
    server.on('stopped', () => {
      setTimeout(done, 1000)
    })
    server.stop()
  }

  startServer (serverNumber, done) {
    const serverPort = Object.keys(this.servers)[serverNumber]
    this._startHTTPServer(serverPort, () => {
      setTimeout(done, 1000)
    })
  }

  stop () {
    for (const port in this.servers) {
      if (this.servers[port].isRunning()) {
        try {
          this.servers[port].stop()
        } catch (e) {
          console.log('couldn\'t stop server', port, 'in teardown', e)
        }
      }
    }
  }

  _startHTTPServer (wsPort, httpPort, done) {
    const config = {
      serverName : `server-${wsPort}/${httpPort}`,

      stateReconciliationTimeout : 100,
      clusterKeepAliveInterval   : 100,
      clusterActiveCheckInterval : 100,
      clusterNodeInactiveTimeout : 200,
      lockTimeout                : 1000,
      shuffleListenProviders     : false,
      rpcTimeout                 : 50,

      showLogo : false,
      stopped  : this._checkStopped.bind(this),

      connectionEndpoints: {
        websocket: {
          name: 'uws',
          options: {
            port: wsPort,
            host: '0.0.0.0',
            urlPath: '/deepstream',
            healthCheckPath: '/health-check',
            heartbeatInterval: 30000,
            outgoingBufferTimeout: 0,
            unauthenticatedClientTimeout: 180000,
            maxAuthAttempts: 3,
            logInvalidAuthData: false,
            maxMessageSize: 1048576
          }
        },
        http: {
          path: './src/plugin',
          options: {
            healthCheckPath: '/health-check',
            enableAuthEndpoint: true,
            authPath: '/api/v1/auth',
            postPath: '/api/v1',
            getPath: '/api/v1',
            allowAllOrigins: true,
            port: httpPort,
            host: '0.0.0.0',
            requestTimeout: 80
          }
        }
      },

      maxAuthAttempts              : 2,
      unauthenticatedClientTimeout : 200,
      auth : {
        type    : 'none',
      },
      permission: {
        type    : 'config',
        options : {
          path: './test-e2e/config/permissions.yml'
        }
      }
    }

    this.servers[wsPort] = this.servers[httpPort] = new DeepstreamServer(config)

    if (this._enableLogging !== true) {
      this.servers[wsPort].set('logger', new Logger())
    }
    if (done instanceof Function) {
      this.servers[wsPort].on('started', done)
    } else {
      this.servers[wsPort].on('started', this._checkReady.bind(this, wsPort))
    }

    /*
     *this.servers[port].set('storage', {
     *  set: () => {},
     *  get: (name, callback) => {
     *    callback(null, { _v: 0, _d: {} })
     *  },
     *  isReady: true
     *})
     */
    const tokens = new Map()
    this.servers[wsPort].set('authenticationHandler', {
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
        callback(false)
      }
    })
    this.servers[wsPort].on('stopped', this._checkStopped.bind(this))
    this.servers[wsPort].start()
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
