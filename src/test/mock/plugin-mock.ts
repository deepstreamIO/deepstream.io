import { DeepstreamPlugin } from '../../../ds-types/src/index'
import { EventEmitter } from 'events'

export default class PluginMock extends DeepstreamPlugin {
  public isReady: boolean = false
  public description: string = this.name || 'mock-plugin'
  private emitter = new EventEmitter()

  constructor (options: any, private name?: string) {
    super()
  }

  public setReady () {
    this.isReady = true
    this.emitter.emit('ready')
  }

  public async whenReady () {
    if (!this.isReady) {
      await new Promise((resolve) => {
        this.emitter.once('ready', resolve)
        setTimeout(resolve, 20)
      })
    }
  }
}
