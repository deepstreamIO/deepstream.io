import DistributedClusterNode from '../../src/cluster/distributed-cluster-node'
import { Message, TOPIC } from '../../src/constants'
import { EventEmitter } from 'events'
import { DeepstreamServices, InternalDeepstreamConfig } from '../../src/types'

export class E2EClusterNode extends DistributedClusterNode {
    public description: string = 'E2EClusterNode'
    private static emitters = new Map<string, EventEmitter>()

    constructor (options: any, services: DeepstreamServices, config: InternalDeepstreamConfig) {
        super(options, services, config)
        E2EClusterNode.emitters.set(this.config.serverName, new EventEmitter())
    }

    public sendDirect (toServer: string, message: Message, metaData?: any): void {
      process.nextTick(() => {
        E2EClusterNode.emitters.get(toServer)!.emit(TOPIC[message.topic], this.config.serverName, message)
      })
    }

    public send (message: Message, metaData?: any): void {
            for (const [serverName, emitter] of E2EClusterNode.emitters) {
                if (serverName !== this.config.serverName) {
                    emitter.emit(TOPIC[message.topic], this.config.serverName, message)
                }
            }
    }

    public subscribe (topic: TOPIC, callback: (message: Message, serverName: string) => void): void {
        E2EClusterNode.emitters.get(this.config.serverName)!.on(TOPIC[topic], (fromServer, message) => {
            if (fromServer === this.config.serverName) {
                throw new Error('Cyclic message was sent!')
            }
            callback(message, fromServer)
        })
    }

    public async close () {
        E2EClusterNode.emitters.delete(this.config.serverName)
    }
  }
