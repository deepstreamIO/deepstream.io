import { DeepstreamServices, NamespacedLogger } from '@deepstream/types'
import { MonitoringBase } from '../monitoring-base'

interface HTTPMonitoringOptions {
    logInterval: number,
    monitoringKey: string
}

export default class LogMonitoring extends MonitoringBase {
    public description = 'Log Monitoring'
    private logInterval!: NodeJS.Timeout
    private logger: NamespacedLogger

    constructor (private pluginOptions: HTTPMonitoringOptions, services: DeepstreamServices) {
        super(services)
        this.pluginOptions.monitoringKey = pluginOptions.monitoringKey || 'LOG_MONITORING'
        this.logger = this.services.logger.getNameSpace(this.pluginOptions.monitoringKey)
        this.pluginOptions.logInterval = pluginOptions.logInterval || 15000
        this.description += ` every ${this.pluginOptions.logInterval / 1000} seconds`
    }

    public async whenReady (): Promise<void> {
        let lastDate = Date.now()
        this.logInterval = setInterval(() => {
            const newDate = Date.now()
            this.logger.info(`Monitoring stats for ${lastDate} to ${newDate}`, JSON.stringify({
                [this.pluginOptions.monitoringKey]: this.getAndResetMonitoringStats(),
                from: lastDate,
                to: newDate
            }))
            lastDate = newDate
        }, this.pluginOptions.logInterval)
    }

    public async close (): Promise<void> {
        clearInterval(this.logInterval)
    }
}
