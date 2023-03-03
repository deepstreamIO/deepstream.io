#!/usr/bin/env node
import * as pgk from '../package.json'

import { Command } from 'commander'
import { start } from './deepstream-start'
import { info } from './deepstream-info'
import { hash } from './deepstream-hash'
import { service } from './deepstream-service'
import { daemon } from './deepstream-daemon'
import { verticalCluster } from './deepstream-cluster'
import { nginx } from './deepstream-nginx'

const program = new Command('deepstream')
program
  .usage('[command]')
  .version(pgk.version.toString())

start(program)
info(program)
hash(program)
service(program)
daemon(program)
verticalCluster(program)
nginx(program)

program.parse(process.argv)

if (program.rawArgs.length <= 2) {
  program.emit('command:start')
}
