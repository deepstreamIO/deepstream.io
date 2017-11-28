#!/usr/bin/env node
import * as pgk from '../../package.json'

import { Command } from 'commander'
import { install } from './deepstream-install'
import { start } from './deepstream-start'
import { info } from './deepstream-info'
import { hash } from './deepstream-hash'
import { service } from './deepstream-service'
import { daemon } from './deepstream-daemon'

const program = new Command('deepstream')
program
  .usage('[command]')
  .version(pgk.version.toString())

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
