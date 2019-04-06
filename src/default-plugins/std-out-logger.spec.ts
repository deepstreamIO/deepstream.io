import 'mocha'
import { expect } from 'chai'
import {spy} from 'sinon'

import Logger from './std-out-logger'
import * as C from '../constants'

describe('logs to stdout and stderr', () => {
  const logger = new Logger({ color: false })
  const originalStdOut = process.stdout
  const originalStdErr = process.stderr
  const stdout = spy()
  const stderr = spy()
  const comp = function (std, exp) {
    return std.lastCall.args[0].indexOf(exp) !== -1
  }

  before(() => {
    Object.defineProperty(process, 'stdout', {
      value: { write: stdout }
    })
    Object.defineProperty(process, 'stderr', {
      value: { write: stderr }
    })
  })

  after(() => {
    Object.defineProperty(process, 'stdout', {
      value: originalStdOut
    })
    Object.defineProperty(process, 'stderr', {
      value: originalStdErr
    })
  })

  it('creates the logger', () => {
    expect(logger.isReady).to.equal(true)
    logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, 'b')
    expect(comp(stdout, 'INFO | b')).to.equal(true)
  })

  it('logs to stderr', () => {
    stdout.resetHistory()
    logger.log(C.LOG_LEVEL.ERROR, C.EVENT.INFO, 'e')
    expect(stdout).to.have.callCount(0)
    expect(stderr).to.have.callCount(1)
  })

  it('logs above log level', () => {
    logger.setLogLevel(C.LOG_LEVEL.DEBUG)
    stdout.resetHistory()
    logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, 'e')
    expect(stdout).to.have.callCount(1)
    logger.setLogLevel(C.LOG_LEVEL.WARN)
    stdout.resetHistory()
    logger.log(C.LOG_LEVEL.INFO, C.EVENT.INFO, 'e')
    expect(stdout).to.have.callCount(0)
  })
})
