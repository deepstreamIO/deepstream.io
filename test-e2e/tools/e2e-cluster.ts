import { EventEmitter } from 'events'
import { PromiseDelay } from '../../src/utils/utils'
import { Deepstream } from '../../src/deepstream.io'
import ConfigPermissionHandler from '../../src/permission/config-permission-handler'
import LocalCache from '../../src/default-plugins/local-cache'
import { E2EAuthenticationHandler } from './e2e-authentication-handler'
import { getServerConfig } from './e2e-server-config'
import { E2ELogger } from './e2e-logger'
import { E2EClusterNode } from './e2e-cluster-node'
import { STATES } from '../../src/constants'

const cache = new LocalCache()

const SERVER_STOP_OR_START_DURATION = 200

const authenticationHandler = new E2EAuthenticationHandler()

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
    return `localhost:${this.ports[serverId - 1]}/e2e`
  }

  public getHttpUrl (serverId: number) {
    return `localhost:${this.ports[serverId - 1] + 200}/`
  }

  public getAuthUrl (serverId: number) {
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
    server.set('authenticationHandler', authenticationHandler)
    // @ts-ignore
    server.set('message', new E2EClusterNode({}, server.services, server.config))
    server.start()

    await startedPromise
    await PromiseDelay(SERVER_STOP_OR_START_DURATION * 2)
  }

  public async whenReady () {
    const startedPromises = this.servers.reduce((result, server) => {
      if (!server.isRunning()) {
        result.push(new Promise((resolve) => server.on('started', resolve)))
      }
      return result
    }, [] as Array<Promise<void>>)
    await Promise.all(startedPromises)
    await PromiseDelay(SERVER_STOP_OR_START_DURATION)
  }

  public async whenStopped () {
    const stopPromises = this.servers.reduce((result, server) => {
      // @ts-ignore
      if (server.currentState !== STATES.STOPPED) {
        result.push(new Promise((resolve) => server.on('stopped', resolve)))
      }
      return result
    }, [] as Array<Promise<void>>)
    await Promise.all(stopPromises)
    await PromiseDelay(SERVER_STOP_OR_START_DURATION)
    this.servers = []
  }
}
