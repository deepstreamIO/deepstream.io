import { EventEmitter } from 'events'

export default class NoopStorage extends EventEmitter implements StoragePlugin {
  public description: string
  public isReady: boolean

  private config?: InternalDeepstreamConfig
  private data: any

  constructor (config?: InternalDeepstreamConfig, services?: DeepstreamServices) {
    super()
    this.config = config
    this.isReady = true
    this.description = 'noop storage'
  }

  public set (key: string, version: number, data: any, callback: Function) {
    process.nextTick(() => callback(null))
  }

  public get (key: string, callback: Function) {
    process.nextTick(() => callback(null, -1, null))
  }

  public delete (key: String, callback: Function) {
    process.nextTick(() => callback(null))
  }
}
