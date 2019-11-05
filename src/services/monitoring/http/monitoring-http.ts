import { DeepstreamServices, DeepstreamHTTPMeta, DeepstreamHTTPResponse, EVENT } from '@deepstream/types'
import { MonitoringBase } from '../monitoring-base'

interface HTTPMonitoringOptions {
    url: string,
    headerKey: string,
    headerValue: string,
    allowOpenPermissions: boolean
}

export default class HTTPMonitoring extends MonitoringBase {
    public description = `HTTP Monitoring on ${this.pluginOptions.url}`
    private logger = this.services.logger.getNameSpace('HTTP_MONITORING')

    constructor (private pluginOptions: HTTPMonitoringOptions, services: DeepstreamServices) {
        super(services)
        process.nextTick(() => {
            if (typeof pluginOptions.url !== 'string') {
                this.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'Missing "url" for HTTP Monitoring')
            }
            if (this.pluginOptions.allowOpenPermissions) {
                this.logger.warn(EVENT.PLUGIN_INITIALIZATION_ERROR, '"allowOpenPermissions" is set. Try not to deploy to production')
            } else if (!pluginOptions.headerKey || !pluginOptions.headerValue) {
                this.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'Missing "headerKey" and/or "headerValue"')
            }
        })

    }

    public async whenReady (): Promise<void> {
        await this.services.httpService.whenReady()

        let from = Date.now()
        this.services.httpService.registerGetPathPrefix(this.pluginOptions.url, (metaData: DeepstreamHTTPMeta, response: DeepstreamHTTPResponse) => {
            if (this.pluginOptions.allowOpenPermissions !== true) {
                if (metaData.headers[this.pluginOptions.headerKey] !== this.pluginOptions.headerValue) {
                    this.logger.warn(EVENT.AUTH_ERROR, 'Invalid monitoring data due to missing or invalid header values')
                    return response({
                        statusCode: 404,
                        message: 'Endpoint not found.'
                    })
                }
            }
            const to = Date.now()
            response(null, {
                from,
                to,
                ...this.getAndResetMonitoringStats()
            })
            from = to
        })
    }

    public async close (): Promise<void> {
    }
}
