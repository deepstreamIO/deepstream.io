import { TOPIC, Message, StateMessage } from '../constants'
import DistributedClusterNode from './distributed-cluster-node'

export class SingleClusterNode extends DistributedClusterNode {
  public description = 'Single Cluster Node'

  public sendDirect (serverName: string, message: Message, metaData?: any) {}

  public sendState (message: StateMessage, metaData?: any) {}

  public sendStateDirect (serverName: string, message: StateMessage, metaData?: any) {}

  public send (message: Message, metaData?: any) {}

  public subscribe (stateRegistryTopic: TOPIC, callback: Function) {}

  public async close (): Promise<void> {}
}
