import { EventEmitter } from 'events'

export default class LocalCache extends EventEmitter implements StoragePlugin {
  public description: string
  public isReady: boolean
  public apiVersion: number

  private config?: InternalDeepstreamConfig
  private data: any

  constructor (config?: InternalDeepstreamConfig, services?: DeepstreamServices) {
    super()
    this.isReady = true
    this.config = config
    this.data = new Map()
    this.description = 'local cache'
    this.apiVersion = 2
  }

  public set (key: string, version: number, data: any, callback: StorageWriteCallback) {
    this.data.set(key, { version, data })
    process.nextTick(() => callback(null))
  }

  public get (key: string, callback: StorageReadCallback) {
    const data = this.data.get(key)
    if (!data) {
      process.nextTick(() => callback(null, -1, null))
    } else {
      process.nextTick(() => callback(null, data.version, data.data))
    }
  }

  public delete (key: string, callback: StorageWriteCallback) {
    this.data.delete(key)
    process.nextTick(() => callback(null))
  }
}
