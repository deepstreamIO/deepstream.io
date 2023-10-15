import { Command } from 'commander'
import * as cluster from 'cluster'
const numCPUs = require('os').cpus().length
import { EVENT } from '@deepstream/types'

export const verticalCluster = (program: Command) => {
  program
    .command('cluster')
    .description('start a vertical cluster of deepstream servers')

    .option('-c, --config [file]', 'configuration file, parent directory will be used as prefix for other config files')
    .option('-l, --lib-dir [directory]', 'path where to lookup for plugins like connectors and logger')

    .option('--cluster-size <amount>', 'the amount of nodes to run in the cluster. Defaults to all available cores')
    .option('--host <host>', 'host for the http service')
    .option('--port <port>', 'port for the http service')
    .option('--disable-auth', 'Force deepstream to use "none" auth type')
    .option('--disable-permissions', 'Force deepstream to use "none" permissions')
    .option('--log-level <level>', 'Log messages with this level and above')
    .action(action)
}

function action () {
    // @ts-ignore
    global.deepstreamCLI = this
    const workers = new Set<any>()

    if (!global.deepstreamCLI.clusterSize) {
      global.deepstreamCLI.clusterSize = numCPUs
    }

    if (global.deepstreamCLI.clusterSize && global.deepstreamCLI.clusterSize > numCPUs) {
      console.warn('Setting more nodes than available cores can decrease performance')
    }

    const setupWorkerProcesses = () => {
        console.log('Master cluster setting up ' + global.deepstreamCLI.clusterSize + ' deepstream nodes')

        for (let i = 0; i < global.deepstreamCLI.clusterSize; i++) {
            workers.add(cluster.fork())
        }

        // process is clustered on a core and process id is assigned
        cluster.on('online', (worker) => {
            console.log(`Deepstream ${worker.process.pid} is listening`)
        })

        // if any of the worker process dies then start a new one by simply forking another one
        cluster.on('exit', (worker, code, signal) => {
            console.log(`Deepstream ${worker.process.pid} died with code: ${code}, and signal: ${signal}`)
            console.log('Starting a new worker')
            workers.delete(worker)
            workers.add(cluster.fork())
        })
    }

    // if it is a master process then call setting up worker process
    // @ts-ignore
    if (cluster.isPrimary) {
        setupWorkerProcesses()
    } else {
        const { Deepstream } = require('../src/deepstream.io')
        try {
          const ds = new Deepstream(null)
          ds.on(EVENT.FATAL_EXCEPTION, () => process.exit(1))
          ds.start()
          process
            .removeAllListeners('SIGINT').on('SIGINT', () => {
              ds.on('stopped', () => process.exit(0))
              ds.stop()
            })
        } catch (err: any) {
          console.error(err.toString())
          process.exit(1)
        }
    }
}
