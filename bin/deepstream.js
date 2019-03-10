#!/usr/bin/env node
'use strict'
require('colors')

const pgk = require('../package.json')

const Command = require('commander').Command
const install = require('./deepstream-install')
const start = require('./deepstream-start')
const info = require('./deepstream-info')
const hash = require('./deepstream-hash')
const service = require('./deepstream-service')
const daemon = require('./deepstream-daemon')

/**
 * This is used by the binary build to replace the first argument (path to nodeJS file)
 * with the second (deepstream binary).
 *
 * Node args:
 *
 * [ '.../n/bin/node', '.../deepstream.io/bin/deepstream' ]
 *
 * Actual binary args:
 *
 * [ 'deepstream', 'bin/deepstream.js' ]
 *
 * Wanted binary args:
 *
 * [ 'deepstream', 'deepstream' ]
 */
if (process.argv[0].endsWith('deepstream')) {
	process.argv[1] = process.argv[0]
}

const program = new Command('deepstream')
program
	.usage('[command]')
	.version(pgk.version)

start(program)
install(program)
info(program)
hash(program)
service(program)
daemon(program)

program.parse(process.argv)

if (program.args.length === 0) {
  program.emit('command:start')
}
