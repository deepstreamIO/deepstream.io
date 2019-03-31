import {When, Then, Given} from 'cucumber'
import * as path from 'path'
import { Deepstream } from '../../src/deepstream.io'
import LocalCache from '../../src/default-plugins/local-cache'

import { EventEmitter } from 'events'
import { Logger } from './test-logger'

const onlyLoginOnceUser = { loggedIn: false }
const localCache = new LocalCache()

export class Cluster extends EventEmitter {
  private wsPort: any
  private httpPort: any
  private server: any
  private enableLogging: any
  public started: boolean

  constructor (wsPort, httpPort, enableLogging) {
    super()
    this.wsPort = wsPort
    this.httpPort = httpPort
    this.server = null
    this.enableLogging = enableLogging
    this.started = false
    this._startServer()
  }

  public getUrl () {
    return `localhost:${this.wsPort}`
  }

  public getHttpUrl () {
    return `localhost:${this.httpPort}`
  }

  public getAuthUrl () {
    return `localhost:${this.httpPort}/auth`
  }

  public updatePermissions (type, done) {
    this.server.services.permissionHandler.once('config-loaded', () => done())
    this.server.services.permissionHandler.loadConfig(path.resolve(`./test-e2e/config/permissions-${type}.json`))
  }

  public start () {
    if (this.started) {
      this.emit('started')
      return
    }
    this.started = true
    this._startServer()
  }

  public stop () {
    if (!this.started) {
      this.emit('stopped')
      return
    }
    this.started = false
    this.server.stop()
  }

  public _startServer () {
    this.started = true
    this.server = new Deepstream({
      serverName : `server-${this.wsPort}`,

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
            port: this.wsPort,
            heartbeatInterval: 5000
          }
        },
        http: {
          name: 'http',
          options: {
            port: this.httpPort,
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
    this.server.set('authenticationHandler', {
      isReady: true,
      isValidUser (headers, authData, callback) {
        if (authData.token) {
          if (authData.token === 'letmein') {
            callback(true, { username: 'A' })
            return
          }

          // authenticate token
          const response = tokens.get(authData.token)
          if (response.username) {
            callback(true, response)
            return
          }
        }
        const username = authData.username
        const token = Math.random().toString()
        let clientData: any = null
        const serverData: any = {}
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
          clientData = { 'favorite color': 'orange', 'id': username }
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

    this.server.set('cache', localCache)

    if (this.enableLogging !== true) {
      this.server.set('logger', new Logger())
    }

    this.server.once('started', () => setTimeout(() => this.emit('started'), 500))
    this.server.once('stopped', () => setTimeout(() => this.emit('stopped'), 500))
    this.server.start()
  }

}
