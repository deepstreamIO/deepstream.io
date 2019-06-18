import DistributedClusterNode from '../../src/cluster/distributed-cluster-node'
import { Message, TOPIC } from '../../src/constants'
import { EventEmitter } from 'events'

export class E2EClusterNode extends DistributedClusterNode {
    public description: string = 'E2EClusterNode'
    private emitter = new EventEmitter()

    public sendDirect (serverName: string, message: Message, metaData?: any): void {
      process.nextTick(() => {
        this.emitter.emit(`${serverName}/${TOPIC[message.topic]}`, message)
      })
    }

    public send (message: Message, metaData?: any): void {
    }

    public subscribe (stateRegistryTopic: TOPIC, callback: Function): void {
    }

    public async close () {
    }
  }
