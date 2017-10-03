import { EventEmitter } from 'events'

export default class LocalCache extends EventEmitter implements StoragePlugin {
  public description: string
  public isReady: boolean
  
  private config: DeepstreamConfig
  private data: any

  constructor (config: DeepstreamConfig, services: DeepstreamServices) {
    super()
    this.config = config
    this.isReady = true
    this.data = {}
    this.description = 'local cache'
  }

  set (key: string, value: object, callback: Function) {
    this.data[key] = value
    callback(null)
  }

  get (key: string, callback: Function) {
    callback(null, this.data[key] || null)
  }

  delete (key: string, callback: Function) {
    delete this.data[key]
    callback(null)
  }
}

