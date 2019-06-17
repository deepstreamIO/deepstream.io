import * as path from 'path'
import { Deepstream } from '../../src/deepstream.io'
import LocalCache from '../../src/default-plugins/local-cache'

import { EventEmitter } from 'events'
import { TestLogger } from './test-logger'
import { DeepstreamPlugin, AuthenticationHandler, UserAuthenticationCallback } from '../../src/types'
import { JSONObject } from '../../src/constants'

const onlyLoginOnceUser = { loggedIn: false }
const localCache = new LocalCache()
const tokens = new Map()

class ClusterTestAuthenticationHandler extends DeepstreamPlugin implements AuthenticationHandler {
  public description: string = 'ClusterTestAuthenticationHandler'

  public isValidUser (headers: JSONObject, authData: any, callback: UserAuthenticationCallback) {
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
}

// tslint:disable-next-line: max-classes-per-file
export class Cluster extends EventEmitter {
  private server: Deepstream
  private started: boolean = false

  constructor (private wsPort: number, private httpPort: number, private enableLogging: boolean) {
    super()
    this.server = this._startServer()
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

  public updatePermissions (type: string, done: Function) {
    this.server.getServices().permissionHandler.once('config-loaded', () => done())
    // @ts-ignore
    this.server.getServices().permissionHandler.loadConfig(path.resolve(`./test-e2e/config/permissions-${type}.json`))
  }

  public start () {
    if (this.started) {
      this.emit('started')
      return
    }
    this.started = true
    this.server = this._startServer()
  }

  public stop () {
    if (!this.started) {
      this.emit('stopped')
      return
    }
    this.started = false
    this.server.stop()
  }

  public _startServer (): Deepstream {
    this.started = true
    this.server = new Deepstream({
      showLogo : false,
      serverName : `server-${this.wsPort}`,

      cluster: {
        message: {
          options: {

          }
        },
        registry: {
          options: {

          }
        },
        state: {
          options: {
            reconciliationTimeout: 100,
          }
        },
        locks: {
          options: {
            lockTimeout: 1000,
          }
        }
      },

      listen: {
        shuffleProviders: false
      },

      rpc: {
        responseTimeout: 30
      },

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
            heartbeatInterval: 5000,
            headers: [],
            maxAuthAttempts              : 2,
            unauthenticatedClientTimeout : 200
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
            requestTimeout: 80,
            headers: [],
            maxMessageSize: 1024
          }
        }
      },
    })

    this.server.set('authenticationHandler', new ClusterTestAuthenticationHandler())
    this.server.set('cache', localCache)

    if (this.enableLogging !== true) {
      this.server.set('logger', new TestLogger())
    }

    this.server.once('started', () => setTimeout(() => this.emit('started'), 500))
    this.server.once('stopped', () => setTimeout(() => this.emit('stopped'), 500))
    this.server.start()

    return this.server
  }

}
