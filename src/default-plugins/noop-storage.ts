import { EventEmitter } from 'events'

export default class NoopStorage extends EventEmitter implements StoragePlugin {
  public description: string
  public isReady: boolean
  public apiVersion: number

  private config?: InternalDeepstreamConfig
  private data: any

  constructor (config?: InternalDeepstreamConfig, services?: DeepstreamServices) {
    super()
    this.config = config
    this.isReady = true
    this.description = 'noop storage'
    this.apiVersion = 2
  }

  public set (key: string, version: number, data: any, callback: StorageWriteCallback) {
    process.nextTick(() => callback(null))
  }

  public get (key: string, callback: StorageReadCallback) {
    process.nextTick(() => callback(null, -1, null))
  }

  public delete (key: string, callback: StorageWriteCallback) {
    process.nextTick(() => callback(null))
  }
}
