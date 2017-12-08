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

  public set (key: string, version: number, data: any, callback: StorageWriteCallback) {
    this.data[key] = { version, data }
    process.nextTick(() => callback(null))
  }

  public get (key: string, callback: StorageReadCallback) {
    if (!this.data[key]) {
      process.nextTick(() => callback(null, -1, null))
    } else {
      process.nextTick(() => callback(null, this.data[key].version, this.data[key].data))
    }
  }

  public delete (key: string, callback: StorageWriteCallback) {
    delete this.data[key]
    process.nextTick(() => callback(null))
  }
}
