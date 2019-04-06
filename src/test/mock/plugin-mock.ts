import { EventEmitter } from 'events'
const util = require('util')

export default class PluginMock extends EventEmitter {
  public isReady: boolean
  public description: string
  public options: any
  public deepstream: any

  constructor (options, name?) {
    super()
    this.isReady = false
    this.description = name || 'mock-plugin'
    this.options = options
  }

  public setDeepstream (deepstream: any) {

  }

  public setReady () {
    this.isReady = true
    this.emit('ready')
  }
}
