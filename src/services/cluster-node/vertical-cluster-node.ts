import { Message, TOPIC } from '../../constants'
import * as cluster from 'cluster'
import { EventEmitter } from 'events'
import { DeepstreamClusterNode, DeepstreamPlugin, DeepstreamServices, DeepstreamConfig, EVENT } from '@deepstream/types'

if (cluster.isMaster) {
    cluster.on('message', (worker, serializedMessage: string, handle) => {
        for (const id in cluster.workers) {
            const toWorker = cluster.workers[id]!
            if (toWorker !== worker) {
                toWorker.send(serializedMessage)
            }
        }
    })
}

export class VerticalClusterNode extends DeepstreamPlugin implements DeepstreamClusterNode {
    public description: string = 'Vertical Cluster Message Bus'
    private isReady: boolean = false
    public static emitter = new EventEmitter()
    private callbacks = new Map<string, any>()

    constructor (pluginConfig: any, private services: DeepstreamServices, private config: DeepstreamConfig) {
        super()
    }

    public init () {
        if (cluster.isWorker) {
            process.on('message', (serializedMessage) => {
                if (this.isReady) {
                    const { fromServer, message } = JSON.parse(serializedMessage)

                    VerticalClusterNode.emitter.emit(TOPIC[message.topic], message, fromServer)

                    const callbacks = this.callbacks.get(TOPIC[message.topic])
                        if (!callbacks || callbacks.size === 0) {
                            this.services.logger.warn(EVENT.UNKNOWN_ACTION, `Received message for unknown topic ${TOPIC[message.topic]}`)
                            return
                        }
                        callbacks.forEach((callback: Function) => callback(message, fromServer))
                }
            })
        }
    }

    async whenReady (): Promise<void> {
        this.isReady = true
    }

    public send (message: Message, metaData?: any): void {
        process.send!(JSON.stringify({ message, fromServer: this.config.serverName }))
    }

    public sendDirect (serverName: string, message: Message, metaData?: any): void {
        process.send!(JSON.stringify({ toServer: serverName, fromServer: this.config.serverName, message }))
    }

    public subscribe<SpecificMessage> (stateRegistryTopic: TOPIC, callback: (message: SpecificMessage, originServerName: string) => void): void {
        VerticalClusterNode.emitter.on(TOPIC[stateRegistryTopic], callback)

        let callbacks = this.callbacks.get(TOPIC[stateRegistryTopic])
        if (!callbacks) {
            callbacks = new Set()
            this.callbacks.set(TOPIC[stateRegistryTopic], callbacks)
        }
        callbacks.add(callback)
    }

    public async close (): Promise<void> {
        for (const [topic, callbacks] of this.callbacks) {
            for (const callback of callbacks) {
                VerticalClusterNode.emitter.off(topic, callback)
            }
        }
        this.callbacks.clear()
        this.isReady = false
    }
}
