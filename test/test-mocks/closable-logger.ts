import { EventEmitter } from 'events'
const utils = require('util')

export default class ClosableLogger extends EventEmitter {
  public isReady: boolean

  constructor () {
    super()
    this.isReady = false
    setTimeout(this._setReady.bind(this), 1)
  }

  public log = jasmine.createSpy('log')
  public setLogLevel () {}

  public close () {
    setTimeout(this._setClosed.bind(this), 1)
  }

  private _setReady () {
    this.isReady = true
    this.emit('ready')
  }

  private _setClosed () {
    this.isReady = false
    this.emit('close')
  }
}
