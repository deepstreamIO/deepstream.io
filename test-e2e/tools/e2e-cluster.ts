import { DeepstreamPlugin, AuthenticationHandler, UserAuthenticationCallback, DeepstreamConfig } from '../../src/types'
import { JSONObject, LOG_LEVEL } from '../../src/constants'
import { EventEmitter } from 'events'
import { PromiseDelay } from '../../src/utils/utils'
import { Deepstream } from '../../src/deepstream.io'
import ConfigPermissionHandler from '../../src/permission/config-permission-handler'
import { E2ELogger } from './e2e-logger'
import LocalCache from '../../src/default-plugins/local-cache'

const cache = new LocalCache()
const onlyLoginOnceUser = { loggedIn: false }
const tokens = new Map()

const SERVER_STOP_OR_START_DURATION = 200

const getServerConfig = (port: number): DeepstreamConfig => ({
  serverName : `server-${port}`,
  logLevel: LOG_LEVEL.WARN,
  showLogo : false,

  rpc: {
    ackTimeout: 5,
    responseTimeout: 10,
  },

  listen: {
    shuffleProviders     : false,
  },

  permission: {
    type    : 'config',
    options : {
      path: './test-e2e/config/permissions-open.json'
    } as any
  },

  connectionEndpoints: {
    websocket: {
      name: 'uws',
      options: {
        port,
        urlPath: '/e2e',
        maxAuthAttempts              : 2,
        unauthenticatedClientTimeout : 200,
      } as any
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
      } as any
    }
  },

  monitoring: {
    type: 'default',
    options: {
      reportInterval: 200,
      permissionLogLimit: 3,
      technicalErrorLogLimit: 3
    } as any
  },

  cluster: {
    message: {
      type: 'default',
      options: {

      } as any
    },
    registry: {
      type: 'default',
      options: {
        keepAliveInterval: 200,
        activeCheckInterval: 200
      } as any
    },
    locks: {
      type: 'default',
      options: {
        timeout                : 1500,
        requestTimeout         : 1500,
      } as any
    },
    state: {
      type: 'default',
      options: {
        reconciliationTimeout : 100,
      } as any
    }
  }
})

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
export class E2ECluster extends EventEmitter {
  private servers: Deepstream[] = []

  constructor (private ports: number[], private enableLogging: boolean = false) {
    super()
    this.start()
  }

  public getServerName (serverId: number) {
    return `server-${this.ports[serverId - 1]}`
  }

  public getUrl (serverId: number) {
    serverId = 1
    return `localhost:${this.ports[serverId - 1]}/e2e`
  }

  public getHttpUrl (serverId: number) {
    serverId = 1
    return `localhost:${this.ports[serverId - 1] + 200}/`
  }

  public getAuthUrl (serverId: number) {
    serverId = 1
    return `localhost:${this.ports[serverId - 1] + 200}/auth`
  }

  public async start () {
    for (let i = 1; i <= this.ports.length; i++) {
      this.startServer(i)
    }
    await this.whenReady()
  }

  public async stop () {
    this.servers.forEach((server) => server.stop())
    await this.whenStopped()
  }

  public async updatePermissions (type: string) {
    const promises = this.servers.map((server) => {
      const permissionHandler = server.getServices().permissionHandler as ConfigPermissionHandler
      const promise = new Promise((resolve) => permissionHandler.once('config-loaded', resolve))
      permissionHandler.loadConfig(`./test-e2e/config/permissions-${type}.json`)
      return promise
    })
    await Promise.all(promises)
  }

  public stopServer (serverId: number) {
    serverId = 1

    return new Promise(async (resolve) => {
      const server = this.servers[serverId - 1]
      if (!server) {
        throw new Error(`Server ${serverId} not found`)
      }
      if (server.isRunning() === false) {
        // Single node
        resolve()
        return
      }
      server.on('stopped', async () => {
        await PromiseDelay(SERVER_STOP_OR_START_DURATION)
        // @ts-ignore
        this.servers[serverId - 1] = null
        resolve()
      })
      server.stop()
    })
  }

  public async startServer (serverId: number) {
    serverId = 1

    if (this.servers[serverId - 1]) {
      await PromiseDelay(SERVER_STOP_OR_START_DURATION)
      return
    }

    const server = new Deepstream(getServerConfig(this.ports[serverId - 1]))
    this.servers[serverId - 1] = server
    const startedPromise = new Promise((resolve) => server.on('started', resolve))
    if (this.enableLogging !== true) {
      server.set('logger', new E2ELogger())
    }
    server.set('cache', cache)
    server.set('authenticationHandler', new ClusterTestAuthenticationHandler())
    server.start()

    await startedPromise
  }

  public async whenReady () {
    const startedPromises = this.servers.reduce((result, server) => {
      if (server.isRunning() === false) {
        result.push(new Promise((resolve) => {
          server.on('started', resolve)
        }))
      }
      return result
    }, [] as Array<Promise<void>>)
    await Promise.all(startedPromises)
    await PromiseDelay(SERVER_STOP_OR_START_DURATION)
  }

  public async whenStopped () {
    const stopPromises = this.servers.reduce((result, server) => {
      if (server.isRunning() !== false) {
        result.push(new Promise((resolve) => server.on('stopped', resolve)))
      }
      return result
    }, [] as Array<Promise<void>>)
    await Promise.all(stopPromises)
    await PromiseDelay(SERVER_STOP_OR_START_DURATION)
    this.servers = []
  }
}
