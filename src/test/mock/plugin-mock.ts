import { DeepstreamPlugin, DeepstreamServices, DeepstreamConfig } from '../../../ds-types/src/index'
import { EventEmitter } from 'events'

export default class PluginMock extends DeepstreamPlugin {
  public isReady: boolean = false
  public description: string = this.options.name || 'mock-plugin'
  private emitter = new EventEmitter()

  constructor (private options: any, services: DeepstreamServices, config: DeepstreamConfig) {
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
