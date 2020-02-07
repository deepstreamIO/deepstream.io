import 'mocha'
import { expect } from 'chai'
import {spy} from 'sinon'

import { StdOutLogger } from './std-out-logger'
import { LOG_LEVEL, EVENT } from '@deepstream/types';

describe('logs to stdout and stderr', () => {
  const logger = new StdOutLogger({ color: false })
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

  it('creates the logger', async () => {
    await logger.whenReady()
    logger.log(LOG_LEVEL.INFO, EVENT.INFO, 'b')
    expect(comp(stdout, 'INFO | b')).to.equal(true)
  })

  it('logs to stderr', () => {
    stdout.resetHistory()
    logger.log(LOG_LEVEL.ERROR, EVENT.INFO, 'e')
    expect(stdout).to.have.callCount(0)
    expect(stderr).to.have.callCount(1)
  })

  it('logs above log level', () => {
    logger.setLogLevel(LOG_LEVEL.DEBUG)
    stdout.resetHistory()
    logger.log(LOG_LEVEL.INFO, EVENT.INFO, 'e')
    expect(stdout).to.have.callCount(1)
    logger.setLogLevel(LOG_LEVEL.WARN)
    stdout.resetHistory()
    logger.log(LOG_LEVEL.INFO, EVENT.INFO, 'e')
    expect(stdout).to.have.callCount(0)
  })
})
