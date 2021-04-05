import { DeepstreamTelemetry, DeepstreamPlugin, DeepstreamServices, EVENT, DeepstreamConfig } from '@deepstream/types'
import { getDSInfo } from '../../config/ds-info'
import { v4 as uuid } from 'uuid'
import { validateUUID } from '../../utils/utils'
import { Dictionary } from 'ts-essentials'
import { post } from 'needle'

const TELEMETRY_URL = process.env.TELEMETRY_URL || 'http://telemetry.deepstream.io:8080/api/v1/startup'
const DEFAULT_UUID = '00000000-0000-0000-0000-000000000000'

export interface DeepstreamIOTelemetryOptions {
    enabled: boolean
    debug: boolean
    deploymentId: string
}

export class DeepstreamIOTelemetry extends DeepstreamPlugin implements DeepstreamTelemetry {
    public description = 'Deepstream Telemetry'
    private logger = this.services.logger.getNameSpace('TELEMETRY')

    constructor (private pluginOptions: DeepstreamIOTelemetryOptions, private services: DeepstreamServices, private config: DeepstreamConfig) {
        super()
    }

    public init () {
        if (this.pluginOptions.enabled === false) {
            this.logger.info(
                EVENT.INFO,
                'Telemetry disabled'
            )
            return
        }
        if (this.pluginOptions.deploymentId === undefined || !validateUUID(this.pluginOptions.deploymentId)) {
            this.logger.error(
                EVENT.ERROR,
                `Invalid deployment id, must be uuid format. Feel free to use this one "${uuid()}"`
            )
            this.pluginOptions.deploymentId = DEFAULT_UUID
        }
    }

    public async whenReady (): Promise<void> {
        if (this.pluginOptions.enabled === false) {
            return
        }
        const info = getDSInfo()
        const enabledFeatures = this.config.enabledFeatures
        const config: any = this.config
        const services = Object.keys(this.config).reduce((result, key) => {
            if (!config[key]) {
                return result
            }
            if (config[key].type) {
                result[key] = config[key].type
            } else if (config[key].name) {
                result[key] = {
                    name: config[key].name
                }
            } else if (config[key].path) {
                result[key] = 'custom'
            }
            return result
        }, {} as Dictionary<any>)

        const analytics = {
            deploymentId: this.pluginOptions.deploymentId,
            ...info,
            enabledFeatures,
            services
        }

        if (this.pluginOptions.debug) {
            this.logger.info(EVENT.TELEMETRY_DEBUG, `We would have sent the following: ${JSON.stringify(analytics)}`)
        } else {
            this.sendReport(analytics)
        }
    }

    public async close (): Promise<void> {
    }

    private sendReport (data: any): void {
        post(TELEMETRY_URL, data, { content_type: 'application/json' }, (error: any) => {
          if (error) {
            if (error.code === 'ECONNREFUSED') {
                this.logger.warn(EVENT.TELEMETRY_UNREACHABLE, "Can't reach telemetry endpoint")
            } else {
                console.log(error)
                this.logger.error(EVENT.ERROR, `Telemetry error: ${error}`)
            }
          }
        })
    }
}