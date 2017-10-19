import { EventEmitter } from 'events'

class CustomLogger extends EventEmitter {
  public options: any
  public isReady: boolean

  constructor (options) {
    super()
    this.options = options
    this.isReady = false
    setTimeout(() => {
      this.isReady = true
      this.emit('ready')
    }, 1)
  }

  public log (level, event, msg) {
    console.log('CustomLogger:', level, event, msg)
  }

  public setLogLevel (/* level */) {
  }

}
