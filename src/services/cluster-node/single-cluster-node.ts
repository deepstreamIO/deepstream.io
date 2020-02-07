import { TOPIC, Message } from '../../constants'
import { DeepstreamClusterNode, DeepstreamPlugin } from '@deepstream/types'

export class SingleClusterNode extends DeepstreamPlugin implements DeepstreamClusterNode {
  public description = 'Single Cluster Node'

  public sendDirect (serverName: string, message: Message, metaData?: any) {}

  public send (message: Message, metaData?: any) {}

  public subscribe (stateRegistryTopic: TOPIC, callback: Function) {}

  public async close (): Promise<void> {}
}
