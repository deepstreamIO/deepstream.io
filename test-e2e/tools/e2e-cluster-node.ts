import DistributedClusterNode from '../../src/cluster/distributed-cluster-node'
import { Message, StateMessage, TOPIC } from '../../src/constants'

export class E2EClusterNode extends DistributedClusterNode {
    public description: string = 'E2EClusterNode'

    public sendDirect (serverName: string, message: Message, metaData?: any): void {
      throw new Error('Method not implemented.')
    }
    public sendState (message: StateMessage, metaData?: any): void {
      throw new Error('Method not implemented.')
    }
    public sendStateDirect (serverName: string, message: StateMessage, metaData?: any): void {
      throw new Error('Method not implemented.')
    }
    public send (message: Message, metaData?: any): void {
      throw new Error('Method not implemented.')
    }
    public subscribe (stateRegistryTopic: TOPIC, callback: Function): void {
      throw new Error('Method not implemented.')
    }
    public isLeader (): boolean {
      throw new Error('Method not implemented.')
    }
    public getLeader (): string {
      throw new Error('Method not implemented.')
    }
    public close (): Promise<void> {
      throw new Error('Method not implemented.')
    }
  }
