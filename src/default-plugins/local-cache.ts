import { EventEmitter } from 'events'

export default class LocalCache extends EventEmitter implements StoragePlugin {
  public description: string
  public isReady: boolean

  private config?: DeepstreamConfig
  private data: any

  constructor (config?: DeepstreamConfig, services?: DeepstreamServices) {
    super()
    this.isReady = true
    this.config = config
    this.data = {}
    this.description = 'local cache'
  }

  public set (key: string, value: object, callback: StorageWriteCallback) {
    this.data[key] = value
    process.nextTick(() => callback(null))
  }

  public get (key: string, callback: StorageReadCallback) {
    process.nextTick(() => callback(null, this.data[key] || null))
  }

  public delete (key: string, callback: StorageWriteCallback) {
    delete this.data[key]
    process.nextTick(() => callback(null))
  }
}
