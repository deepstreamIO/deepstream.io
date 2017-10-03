'use strict'

const DeepstreamServer = require('../../dist/src/deepstream.io').default

const util = require('util')
const EventEmitter = require('events').EventEmitter
const Logger = require('./test-logger')

const getUid = require('../../dist/src/utils/utils').getUid

const path = require('path')

module.exports = class DeepstreamTest extends EventEmitter {
  constructor (wsPort, httpPort, enableLogging) {
    super()
    this._wsPort = wsPort
    this._httpPort = httpPort
    this._server = null
    this._enableLogging = enableLogging
    this.started = false
    this._startServer()
  }

  getUrl () {
    return `localhost:${this._wsPort}`
  }

  getHttpUrl () {
    return `localhost:${this._httpPort}`
  }

  getAuthUrl () {
    return `localhost:${this._httpPort}/auth`
  }

  updatePermissions (type, done) {
    this._server.services.permissionHandler.once('config-loaded', () => done())
    this._server.services.permissionHandler.loadConfig(path.resolve(`./test-e2e/config/permissions-${type}.json`))
  }

  start () {
    if (this.started) {
      this.emit('started')
      return
    }
    this.started = true
    this._startServer()
  }

  stop () {
    if (!this.started) {
      this.emit('stopped')
      return
    }
    this.started = false
    this._server.stop()
  }

  _startServer () {
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
          path: './test-e2e/config/permissions-open.json'
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
        const users = ['A', 'B', 'C', 'D', 'W', '1', '2', '3', '4']
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

    if (this._enableLogging !== true) {
      this._server.set('logger', new Logger())
    }

    this._server.once('started', () => setTimeout(() => this.emit('started'), 500))
    this._server.once('stopped', () => setTimeout(() => this.emit('stopped'), 500))
    this._server.start()
  }
  
}
