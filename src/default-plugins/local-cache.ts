export default class LocalCache implements StoragePlugin {
  private data: any
  public description: string
  public isReady: boolean

  constructor (options: any) {
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

