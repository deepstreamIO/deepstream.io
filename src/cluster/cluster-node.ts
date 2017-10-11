import { TOPIC, EVENT } from '../constants'
import StateRegistry from './state-registry'

export default class ClusterNode implements Cluster {
  public stateRegistries: Map<TOPIC, StateRegistry>

  constructor (config: DeepstreamConfig, services: DeepstreamServices, type: string) {
    this.stateRegistries = new Map()
  }

  public sendDirect (serverName: string, message: Message, metaData: any) {}

  public sendState () {}

  public send (message: Message, metaData: any) {}

  public subscribe (topic: string, callback: Function) {}

  public isLeader ():boolean { throw new Error('Leader not used in single state') }

  public getStateRegistry (name: TOPIC) {
    let stateRegistry = this.stateRegistries.get(name)
    if (!stateRegistry) {
      stateRegistry = new StateRegistry(name, {})
      this.stateRegistries.set(name, stateRegistry)
    }
    return stateRegistry
  }

  public close (callback: Function) {
    callback()
  }
}
