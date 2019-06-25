import { TOPIC, Message, StateMessage } from '../../constants'
import { DeepstreamPlugin, ClusterNode } from '../../types'

export class SingleClusterNode extends DeepstreamPlugin implements ClusterNode {
  public description = 'Single Cluster Node'

  public sendDirect (serverName: string, message: Message, metaData?: any) {}

  public sendState (message: StateMessage, metaData?: any) {}

  public sendStateDirect (serverName: string, message: StateMessage, metaData?: any) {}

  public send (message: Message, metaData?: any) {}

  public subscribe (stateRegistryTopic: TOPIC, callback: Function) {}

  public async close (): Promise<void> {}
}
