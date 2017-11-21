'use strict'

const { Deepstream } = require('../../dist/src/deepstream.io')
const LocalCache = require('../../dist/src/default-plugins/local-cache').default
const localCache = new LocalCache()

const util = require('util')
const EventEmitter = require('events').EventEmitter
const Logger = require('./test-logger')

const getUid = require('../../dist/src/utils/utils').getUid

const path = require('path')

let onlyLoginOnceUser = { loggedIn: false }

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
    this._server = new Deepstream({
      serverName : `server-${this._wsPort}`,

      stateReconciliationTimeout : 100,
      lockTimeout                : 1000,
      shuffleListenProviders     : false,
      rpcTimeout: 30,

      showLogo : false,

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
            heartbeatInterval: 10
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
          if (authData.token === 'letmein') {
            callback(true, { username: 'A' })
            return
          }

          // authenticate token
          const authResponseData = tokens.get(authData.token)
          if (authResponseData.username) {
            callback(true, authResponseData)
            return
          }
        }
        const username = authData.username
        const token = Math.random().toString()
        let clientData = null
        const serverData = {}
        let success

        // authenicate auth data
        const users = ['A', 'B', 'C', 'D', 'E', 'F', 'W', '1', '2', '3', '4', 'OPEN']
        if (users.indexOf(username) !== -1 && authData.password === 'abcdefgh') {
          success = true
        } else if (username === 'userA' && authData.password === 'abcdefgh') {
          success = true
          serverData.role = 'user'
        } else if (username === 'userB' && authData.password === '123456789') {
          success = true
          clientData = { 'favorite color': 'orange', id: username }
          serverData.role = 'admin'
        } else if (username === 'randomClientData') {
          success = true
          clientData = { value : Math.random() }
        } else if (username === 'onlyLoginOnce' && !onlyLoginOnceUser.loggedIn) {
          onlyLoginOnceUser.loggedIn = true
          success = true
        } else {
          success = false
        }

        const authResponseData = { username, token, clientData, serverData }

        if (success) {
          tokens.set(token, authResponseData)
          callback(true, authResponseData)
        } else {
          callback(false)
        }
      }
    })

    this._server.set('cache', localCache)

    if (this._enableLogging !== true) {
      this._server.set('logger', new Logger())
    }

    this._server.once('started', () => setTimeout(() => this.emit('started'), 500))
    this._server.once('stopped', () => setTimeout(() => this.emit('stopped'), 500))
    this._server.start()
  }

}
