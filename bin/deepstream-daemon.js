'use strict'

const daemon = require('deepstream.io-service/src/daemon')

module.exports = function (program) {
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
  let processExec
  try {
    require('nexeres')
    processExec = process.argv[0]
  } catch (e) {
    processExec = process.argv[1]
  }

  daemon.start({ processExec })
}
