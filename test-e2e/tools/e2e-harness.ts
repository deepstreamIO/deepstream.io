import { EventEmitter } from 'events'
import { PromiseDelay } from '../../src/utils/utils'
import { Deepstream } from '../../src/deepstream.io'
import { E2EAuthentication } from './e2e-authentication'
import { getServerConfig } from './e2e-server-config'
import { E2ELogger } from './e2e-logger'
import { STATES, JSONValue } from '../../src/constants'
import { LocalCache } from '../../src/services/cache/local-cache'
import { ConfigPermission } from '../../src/services/permission/valve/config-permission'
import { E2EClusterNode } from './e2e-cluster-node'

const cache = new LocalCache()

const SERVER_STOP_OR_START_DURATION = 200

const authenticationHandler = new E2EAuthentication()

export class E2EHarness extends EventEmitter {
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

  public async updateStorageDirectly (recordName: string, version: number, data: JSONValue) {
    this.servers.forEach((server) => {
      server.getServices().storage.set(recordName, version, data, () => {})
    })

    return new Promise((resolve) => setTimeout(resolve, 10))
  }

  public async deleteFromStorageDirectly (recordName: string) {
    this.servers.forEach((server) => {
      server.getServices().storage.delete(recordName, () => {})
    })

    return new Promise((resolve) => setTimeout(resolve, 10))
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
      const permission = server.getServices().permission as never as ConfigPermission
      const promise = new Promise((resolve) => permission.once('config-loaded', resolve))
      permission.loadConfig(`./test-e2e/config/permissions-${type}.json`)
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

    const server = new Deepstream(getServerConfig(this.ports[serverId - 1])) as any
    this.servers[serverId - 1] = server
    const startedPromise = new Promise((resolve) => server.on('started', resolve))
    if (this.enableLogging !== true) {
      server.set('logger', new E2ELogger())
    }
    server.set('cache', cache)
    server.set('authentication', authenticationHandler)
    // @ts-ignore
    server.set('clusterNode', new E2EClusterNode({}, server.services, server.config))
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
