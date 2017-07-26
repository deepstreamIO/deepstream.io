'use strict'

const colors = require('colors')
const os = require('os')
const path = require('path')

module.exports = function (program) {
  program
    .command('start')
    .description('start a deepstream server')

    .option('-c, --config [file]', 'configuration file, parent directory will be used as prefix for other config files')
    .option('-l, --lib-dir [directory]', 'path where to lookup for plugins like connectors and logger')

    .option('--host <host>', 'host for the websocket server')
    .option('--port <port>', 'port for the websocket server', parseInteger.bind(null, '--port'))
    .option('--http-host <host>', 'host for the HTTP server')
    .option('--http-port <port>', 'port for the HTTP server', parseInteger.bind(null, '--http-port'))
    .option('--disable-auth', 'Force deepstream to use "none" auth type')
    .option('--disable-permissions', 'Force deepstream to use "none" permissions')
    .option('--log-level <level>', 'Log messages with this level and above', parseLogLevel)
    .option('--colors [true|false]', 'Enable or disable logging with colors', parseBoolean.bind(null, '--colors'))
    .action(action)
}

function action () {
  global.deepstreamCLI = this

  const Deepstream = require('../src/deepstream.io.js')
  try {
    const ds = new Deepstream(null)
    ds.start()
    process
      .removeAllListeners('SIGINT').on('SIGINT', () => {
        ds.on('stopped', () => process.exit(0))
        ds.stop()
      })
  } catch (err) {
    console.error(err.toString())
    process.exit(1)
  }
}

function detachErrorHandler () {
  console.error('Error during detaching the deepstream process, see logs or run without --detach'.red)
  process.exit(1)
}

/**
* Used by commander to parse the log level and fails if invalid
* value is passed in
* @private
*/
function parseLogLevel (logLevel) {
  if (!/debug|info|warn|error|off/i.test(logLevel)) {
    console.error('Log level must be one of the following (debug|info|warn|error|off)')
    process.exit(1)
  }
  return logLevel.toUpperCase()
}

/**
* Used by commander to parse numbers and fails if invalid
* value is passed in
* @private
*/
function parseInteger (name, port) {
  const portNumber = Number(port)
  if (!portNumber) {
    console.error(`Provided ${name} must be an integer`)
    process.exit(1)
  }
  return portNumber
}

/**
* Used by commander to parse boolean and fails if invalid
* value is passed in
* @private
*/
function parseBoolean (name, enabled) {
  let isEnabled
  if (typeof enabled === 'undefined' || enabled === 'true') {
    isEnabled = true
  } else if (typeof enabled !== 'undefined' && enabled === 'false') {
    isEnabled = false
  } else {
    console.error(`Invalid argument for ${name}, please provide true or false`)
    process.exit(1)
  }
  return isEnabled
}
