export default class NoopStorage implements StoragePlugin {
  private data: any
  public description: string
  public isReady: boolean

  constructor (options: any) {
    this.isReady = true
    this.data = {}
    this.description = 'noop storage'
  }

  set (key: string, value: object, callback: Function) {
    callback(null)
  }

  get (key: string, callback: Function) {
    callback(null, null)
  }

  delete (key: String, callback: Function) {
    callback(null)
  }
}
