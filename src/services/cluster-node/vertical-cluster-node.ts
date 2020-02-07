import { Message, TOPIC } from '../../constants'
import * as cluster from 'cluster'
import { EventEmitter } from 'events'
import { DeepstreamClusterNode, DeepstreamPlugin, DeepstreamServices, DeepstreamConfig } from '@deepstream/types'

if (cluster.isWorker) {
    process.on('message', (serializedMessage) => {
        const { serverName, message }: { serverName: string, message: Message } = JSON.parse(serializedMessage)
        VerticalClusterNode.emitter.emit(TOPIC[message.topic!], message, serverName)
    })
}

if (cluster.isMaster) {
    cluster.on('message', (worker, serializedMessage: string, handle) => {
        for (const id in cluster.workers) {
            const fromWorker = cluster.workers[id]!
            if (fromWorker !== worker) {
                worker.send(serializedMessage)
            }
        }
    })
}

export class VerticalClusterNode extends DeepstreamPlugin implements DeepstreamClusterNode {
    public static emitter = new EventEmitter()
    public description: string = 'Vertical Cluster Message Bus'
    private callbacks = new Map<string, any>()

    constructor (pluginConfig: any, services: DeepstreamServices, private config: DeepstreamConfig) {
        super()
    }

    public send (message: Message, metaData?: any): void {
        process.send!(JSON.stringify({ message, fromServer: this.config.serverName }))
    }

    public sendDirect (serverName: string, message: Message, metaData?: any): void {
        process.send!(JSON.stringify({ toServer: serverName, fromServer: this.config.serverName, message }))
    }

    public subscribe<SpecificMessage> (stateRegistryTopic: TOPIC, callback: (message: SpecificMessage, originServerName: string) => void): void {
        this.callbacks.set(TOPIC[stateRegistryTopic], callback)
        VerticalClusterNode.emitter.on(TOPIC[stateRegistryTopic], callback)
    }

    public async close (): Promise<void> {
        for (const [topic, callback] of this.callbacks) {
            VerticalClusterNode.emitter.off(topic, callback)
        }
    }
}
