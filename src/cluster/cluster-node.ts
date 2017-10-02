/* eslint-disable class-methods-use-this */
import StateRegistry from './state-registry'

export default class ClusterNode {
  private stateRegistries: Map<string, StateRegistry>

  constructor () {
    this.stateRegistries = new Map()
  }

  sendDirect () {}

  sendState () {}

  send () {}

  subscribe () {}

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
