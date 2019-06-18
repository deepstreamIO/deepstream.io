import { DeepstreamPlugin } from '../../types'

export default class PluginMock extends DeepstreamPlugin {
  public isReady: boolean = false
  public description: string = this.name || 'mock-plugin'

  constructor (options: any, private name?: string) {
    super()
  }

  public setReady () {
    this.isReady = true
    this.emit('ready')
  }
}
