import * as pino from 'pino'
import { LOG_LEVEL, DeepstreamPlugin, DeepstreamLogger, DeepstreamServices, NamespacedLogger, EVENT } from '@deepstream/types'

const DSToPino: { [index: number]: string } = {
    [LOG_LEVEL.DEBUG]: 'debug',
    [LOG_LEVEL.FATAL]: 'fatal',
    [LOG_LEVEL.ERROR]: 'error',
    [LOG_LEVEL.WARN]: 'warn',
    [LOG_LEVEL.INFO]: 'info',
}

export class PinoLogger extends DeepstreamPlugin implements DeepstreamLogger {
    public description = 'Pino Logger'
    private logger: pino.Logger = pino()

    constructor (pluginOptions: {}, private services: DeepstreamServices) {
        super()
    }

    /**
     * Return true if logging is enabled. This is used in deepstream to stop generating useless complex strings
     * that we know will never be logged.
     */
    public shouldLog (logLevel: LOG_LEVEL): boolean {
        return this.logger.isLevelEnabled(DSToPino[logLevel])
    }

    /**
     * Set the log level desired by deepstream. Since deepstream uses LOG_LEVEL this needs to be mapped
     * to whatever your libary uses (this is usually just conversion stored in a static map)
     */
    public setLogLevel (logLevel: LOG_LEVEL): void {
        this.logger.level = DSToPino[logLevel]
    }

    /**
     * Log as info
     */
    public info (event: string, message?: string, metaData?: any): void {
        if (metaData) {
            this.logger.info({ ...metaData, message, event })
        } else {
            this.logger.info({ message, event })
        }
    }

    /**
     * Log as debug
     */
    public debug (event: string, message?: string, metaData?: any): void {
        if (metaData) {
            this.logger.debug({ ...metaData, message, event, })
        } else {
            this.logger.debug({ message, event })
        }
    }

    /**
     * Log as warn
     */
    public warn (event: string, message?: string, metaData?: any): void {
        if (metaData) {
            this.logger.warn({ ...metaData, message, event, })
        } else {
            this.logger.warn({ message, event })
        }
    }

    /**
     * Log as error
     */
    public error (event: string, message?: string, metaData?: any): void {
        if (metaData) {
            this.logger.error({ ...metaData, message, event, })
        } else {
            this.logger.error({ message, event })
        }
    }

    /**
     * Log as error
     */
    public fatal (event: string, message?: string, metaData?: any): void {
        if (metaData) {
            this.logger.fatal({ ...metaData, message, event, })
        } else {
            this.logger.fatal({ message, event })
        }
        this.services.notifyFatalException()
    }

    /**
     * Create a namespaced logger, used by plugins. This could either be a new instance of a logger
     * or just a thin wrapper to add the namespace at the beginning of the log method.
     */
    public getNameSpace (namespace: string): NamespacedLogger {
        return {
          shouldLog: this.shouldLog.bind(this),
          fatal: this.log.bind(this, DSToPino[LOG_LEVEL.FATAL], namespace),
          error: this.log.bind(this, DSToPino[LOG_LEVEL.ERROR], namespace),
          warn: this.log.bind(this, DSToPino[LOG_LEVEL.WARN], namespace),
          info: this.log.bind(this, DSToPino[LOG_LEVEL.INFO], namespace),
          debug: this.log.bind(this, DSToPino[LOG_LEVEL.DEBUG], namespace),
        }
    }

    private log (logLevel: string, namespace: string, event: EVENT, message: string) {
        this.logger[logLevel]({ namespace, event, message })
    }
}
