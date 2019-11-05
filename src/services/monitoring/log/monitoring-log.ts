import { DeepstreamServices } from '@deepstream/types'
import { MonitoringBase } from '../monitoring-base'

interface HTTPMonitoringOptions {
    logInterval: number,
    monitoringKey: string
}

export default class LogMonitoring extends MonitoringBase {
    public description = `Log Monitoring every ${this.pluginOptions.logInterval / 1000}seconds`
    private logInterval!: NodeJS.Timeout

    constructor (private pluginOptions: HTTPMonitoringOptions, services: DeepstreamServices) {
        super(services)
        this.pluginOptions.monitoringKey = pluginOptions.monitoringKey || 'DEEPSTREAM_MONITORING'
        this.pluginOptions.logInterval = pluginOptions.logInterval || 15000
    }

    public async whenReady (): Promise<void> {
        let lastDate = Date.now()
        this.logInterval = setInterval(() => {
            const newDate = Date.now()
            this.services.logger.info('MONITORING', `Monitoring stats for ${lastDate} to ${newDate}`, {
                [this.pluginOptions.monitoringKey]: this.getAndResetMonitoringStats(),
                from: lastDate,
                to: newDate
            })
            lastDate = newDate
        }, this.pluginOptions.logInterval)
    }

    public async close (): Promise<void> {
        clearInterval(this.logInterval)
    }
}
