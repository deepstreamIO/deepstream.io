// @ts-ignore
import * as dsDaemon from 'deepstream.io-service/src/daemon'
import * as commander from 'commander'

// work-around for:
// TS4023: Exported variable 'command' has or is using name 'local.Command'
// from external module "node_modules/commander/typings/index" but cannot be named.
// tslint:disable-next-line: no-empty-interface
export interface Command extends commander.Command { }

export const daemon = (program: Command) => {
  program
    .command('daemon')
    .description('start a daemon for deepstream server')

    .option('-c, --config [file]', 'configuration file, parent directory will be used as prefix for other config files')
    .option('-l, --lib-dir [directory]', 'path where to lookup for plugins like connectors and logger')

    .option('--host <host>', 'host for the HTTP/websocket server')
    .option('--port <port>', 'port for the HTTP/websocket server')
    .option('--http-host <host>', 'host for the HTTP server')
    .option('--http-port <port>', 'port for the HTTP server')
    .option('--disable-auth', 'Force deepstream to use "none" auth type')
    .option('--disable-permissions', 'Force deepstream to use "none" permissions')
    .option('--log-level <level>', 'Log messages with this level and above')
    .action(action)
}

function action () {
  dsDaemon.start({ processExec: process.argv[1] })
}
