import { DeepstreamPlugin, DeepstreamServices, EVENT } from '@deepstream/types'
import { writeHeapSnapshot } from 'v8'
import { existsSync, mkdirSync } from 'fs'

interface HeapSnapshotOptions {
    interval: number,
    outputDir: string
}

/**
 * This plugin will log the handshake data on login/logout and send a custom event to the logged-in
 * client.
 */
export default class HeapSnapshot extends DeepstreamPlugin {
    public description = 'V8 Memory Analysis'
    private logger = this.services.logger.getNameSpace('MEMORY_ANALYSIS')
    private snapshotInterval!: NodeJS.Timer

    constructor (private options: HeapSnapshotOptions, private services: Readonly<DeepstreamServices>) {
        super()
    }

    public init () {
        if (typeof this.options.interval !== 'number') {
            this.logger.fatal(EVENT.ERROR, 'Invalid or missing "interval"')
        }
        if (this.options.interval < 10000) {
            this.logger.fatal(EVENT.ERROR, 'interval must be above 10000')
        }
        if (typeof this.options.outputDir !== 'string') {
            this.logger.fatal(EVENT.ERROR, 'Invalid or missing "outputDir"')
        }
        if (existsSync(this.options.outputDir) === false) {
            mkdirSync(this.options.outputDir, 0o744)
        }
    }

    public async whenReady (): Promise<void> {
        this.snapshotInterval = setInterval(() => this.outputHeapSnapshot(), this.options.interval)
    }

    public async close (): Promise<void> {
        clearInterval(this.snapshotInterval)
    }

    private outputHeapSnapshot () {
        writeHeapSnapshot(`${this.options.outputDir}/${Date.now()}-${process.pid}.heapsnapshot`)
        this.logger.info(EVENT.INFO, 'Taking a heap snapshot. This might affect your CPU usage drastically.')
    }
}