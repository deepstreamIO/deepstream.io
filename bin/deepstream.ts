#!/usr/bin/env node
import * as pgk from '../package.json'

import { Command } from 'commander'
import { start } from './deepstream-start'
import { info } from './deepstream-info'
import { hash } from './deepstream-hash'
import { service } from './deepstream-service'
import { daemon } from './deepstream-daemon'
import { nginx } from './deepstream-nginx'

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
  .version(pgk.version.toString())

start(program)
info(program)
hash(program)
service(program)
daemon(program)
nginx(program)

program.parse(process.argv)

if (program.rawArgs.length <= 2) {
  program.emit('command:start')
}
