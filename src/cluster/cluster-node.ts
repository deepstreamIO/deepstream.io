/* eslint-disable class-methods-use-this */
import StateRegistry from './state-registry'

export default class ClusterNode {
  public stateRegistries: Map<string, StateRegistry>

  constructor (config: DeepstreamConfig, services: DeepstreamServices, type: string) {
    this.stateRegistries = new Map()
  }

  sendDirect (serverName: string, topic: string, message: any, metaData: any) {}

  sendState () {}

  send () {}

  subscribe (topic: string, callback: Function) {}

  isLeader () { throw new Error('Leader not used in single state') }

  getStateRegistry (name: string) {
    let stateRegistry = this.stateRegistries.get(name)
    if (!stateRegistry) {
      stateRegistry = new StateRegistry(name, {})
      this.stateRegistries.set(name, stateRegistry)
    }
    return stateRegistry
  }

  close (callback: Function) {
    callback()
  }
}
