import DistributedClusterNode from '../../src/cluster/distributed-cluster-node'
import { Message, TOPIC } from '../../src/constants'
import { EventEmitter } from 'events'
import { DeepstreamServices, InternalDeepstreamConfig } from '../../src/types';

export class E2EClusterNode extends DistributedClusterNode {
    public description: string = 'E2EClusterNode'
    private static emitters = new Map<string, EventEmitter>()

    constructor (options: any, services: DeepstreamServices, config: InternalDeepstreamConfig) {
        super(options, services, config)
        E2EClusterNode.emitters.set(this.config.serverName, new EventEmitter())
    }

    public sendDirect (toServer: string, message: Message, metaData?: any): void {
      process.nextTick(() => {
        E2EClusterNode.emitters.get(this.config.serverName)!.emit(TOPIC[message.topic], this.config.serverName, toServer, message)
      })
    }

    public send (message: Message, metaData?: any): void {
        process.nextTick(() => {
            if (E2EClusterNode.emitters.get(this.config.serverName)) {
                E2EClusterNode.emitters.get(this.config.serverName)!.emit(TOPIC[message.topic], this.config.serverName, null, message)
            }
        })
    }

    public subscribe (topic: TOPIC, callback: (message: Message, serverName: string) => void): void {
        this.on(TOPIC[topic], (fromServer, toServer, message) => {
            if (fromServer === toServer) {
                throw new Error('Cyclic message was sent!')
            }
            if (fromServer === this.config.serverName) {
                return
            }
            if (toServer === null || toServer === this.config.serverName) {
                callback(message, fromServer)
            }
        })
    }

    public async close () {
        E2EClusterNode.emitters.delete(this.config.serverName)
    }
  }
