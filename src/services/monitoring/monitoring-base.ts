import { Message, ACTIONS } from '@deepstream/protobuf/dist/types/messages'
import { TOPIC, STATE_REGISTRY_TOPIC } from '@deepstream/protobuf/dist/types/all'
import { DeepstreamMonitoring, DeepstreamPlugin, DeepstreamServices, LOG_LEVEL, EVENT } from '@deepstream/types'

export abstract class MonitoringBase extends DeepstreamPlugin implements DeepstreamMonitoring {
    private errorLogs: { [index: string]: number } = {}
    private receiveStats: { [index: string]: { [index: string]: number } } = {}
    private sendStats: { [index: string]: { [index: string]: number } } = {}
    private loginStats: { [index: string]: {
        allowed: number,
        declined: number
    } } = {}

    constructor (protected services: DeepstreamServices) {
        super()
    }

    public onErrorLog (loglevel: LOG_LEVEL, event: EVENT, logMessage: string): void {
        const count = this.errorLogs[event]
        if (!count) {
            this.errorLogs[event] = 1
        } else {
            this.errorLogs[event] = count + 1
        }
    }

    /**
     * Called whenever a login attempt is tried and whether or not it succeeded, as well
     * as the connection-endpoint type, which is provided from the connection endpoint
     * itself
     */
    public onLogin (allowed: boolean, endpointType: string): void {
        let stats = this.loginStats[endpointType]
        if (!stats) {
            stats = { allowed: 0, declined: 0 }
            this.loginStats[endpointType] = stats
        }
        allowed ? stats.allowed++ : stats.declined++
    }

    public onMessageReceived (message: Message): void {
        let actionsMap = this.receiveStats[TOPIC[message.topic]]
        if (!actionsMap) {
            actionsMap = {}
            this.receiveStats[TOPIC[message.topic]] = actionsMap
        }
        const actionName = ACTIONS[message.topic][message.action!]
        actionsMap[actionName] = actionsMap[actionName] ? actionsMap[actionName] + 1 : 1
    }

    public onMessageSend (message: Message): void {
        let actionsMap = this.sendStats[TOPIC[message.topic]]
        if (!actionsMap) {
            actionsMap = {}
            this.sendStats[TOPIC[message.topic]] = actionsMap
        }
        const actionName = ACTIONS[message.topic][message.action!]
        actionsMap[actionName] = actionsMap[actionName] ? actionsMap[actionName] + 1 : 1
    }

    public onBroadcast (message: Message, count: number): void {
        let actionsMap = this.receiveStats[TOPIC[message.topic]]
        if (!actionsMap) {
            actionsMap = {}
            this.sendStats[TOPIC[message.topic]] = actionsMap
        }
        const actionName = ACTIONS[message.topic][message.action!]
        actionsMap[actionName] = actionsMap[actionName] ? actionsMap[actionName] + count : count
    }

    public getAndResetMonitoringStats () {
        const results = {
            clusterSize: this.services.clusterRegistry.getAll().length,
            stateMetrics: this.getStateMetrics(),
            errors: this.errorLogs,
            received: this.receiveStats,
            send: this.sendStats,
            logins: this.loginStats
        }
        this.errorLogs = {}
        this.receiveStats = {}
        this.sendStats = {}
        this.loginStats = {}
        return results
    }

    private getStateMetrics () {
        const result: any = {}
        const stateRegistries = this.services.clusterStates.getStateRegistries()
        for (const [topic, stateRegistry] of stateRegistries) {
            result[TOPIC[topic] || STATE_REGISTRY_TOPIC[topic]] = stateRegistry.getAll().length
        }
        return result
    }

}
