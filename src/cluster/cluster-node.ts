import { EVENT, TOPIC } from '../constants'
import StateRegistry from './state-registry'

export default class ClusterNode implements Cluster {
  public stateRegistries = new Map<TOPIC, StateRegistry>()

  constructor (private config: InternalDeepstreamConfig, services: DeepstreamServices, type: string) {}

  public sendDirect (serverName: string, message: Message, metaData?: any) {}

  public sendState () {}

  public send (stateRegistryTopic: TOPIC, message: Message, metaData?: any) {}

  public subscribe (stateRegistryTopic: TOPIC, callback: Function) {}

  public isLeader (): boolean { throw new Error('Leader not used in single state') }

  public getStateRegistry (stateRegistryTopic: TOPIC) {
    let stateRegistry = this.stateRegistries.get(stateRegistryTopic)
    if (!stateRegistry) {
      stateRegistry = new StateRegistry(stateRegistryTopic, this.config)
      this.stateRegistries.set(stateRegistryTopic, stateRegistry)
    }
    return stateRegistry
  }

  public close (callback: Function) {
    callback()
  }
}
