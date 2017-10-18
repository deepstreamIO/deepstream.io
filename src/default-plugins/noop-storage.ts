import { EventEmitter } from 'events'

export default class NoopStorage extends EventEmitter implements StoragePlugin {
  public description: string
  public isReady: boolean

  private config?: DeepstreamConfig
  private data: any

  constructor (config?: DeepstreamConfig, services?: DeepstreamServices) {
    super()
    this.config = config
    this.isReady = true
    this.description = 'noop storage'
  }

  public set (key: string, value: object, callback: Function) {
    callback(null)
  }

  public get (key: string, callback: Function) {
    callback(null, null)
  }

  public delete (key: String, callback: Function) {
    callback(null)
  }
}
