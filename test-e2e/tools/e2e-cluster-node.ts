import { Message, TOPIC, STATE_REGISTRY_TOPIC } from '../../src/constants'
import { EventEmitter } from 'events'
import { DeepstreamServices, DeepstreamConfig, DeepstreamPlugin, DeepstreamClusterNode } from '../../ds-types/src/index'

export class E2EClusterNode extends DeepstreamPlugin implements DeepstreamClusterNode {
    public description: string = 'E2EClusterNode'
    private static emitters = new Map<string, EventEmitter>()

    constructor (options: any, services: DeepstreamServices, private config: DeepstreamConfig) {
        super()
        E2EClusterNode.emitters.set(this.config.serverName, new EventEmitter())
    }

    public sendDirect (toServer: string, message: Message, metaData?: any): void {
      const msg = { ...message }
      process.nextTick(() => {
        E2EClusterNode.emitters.get(toServer)!.emit(TOPIC[message.topic], this.config.serverName, msg)
      })
    }

    public send (message: Message, metaData?: any): void {
        const msg = { ...message }
        process.nextTick(() => {
            for (const [serverName, emitter] of E2EClusterNode.emitters) {
                if (serverName !== this.config.serverName) {
                    emitter.emit(TOPIC[message.topic], this.config.serverName, msg)
                }
            }
        })
    }

    public subscribe<SpecificMessage> (topic: STATE_REGISTRY_TOPIC, callback: (message: SpecificMessage, serverName: string) => void): void {
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
