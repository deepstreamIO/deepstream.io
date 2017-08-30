/* eslint-disable camelcase */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach, xdescribe  */
'use strict'

const child_process = require('child_process')
const path = require('path')
const Deepstream = require('../src/deepstream.io')
const ClosableLogger = require('./mocks/closable-logger')
const LoggerMock = require('./mocks/logger-mock')
const http = require('http')

describe('deepstream.io', () => {

  describe('the main server class', () => {
    it('exposes the message parser\'s convertTyped method', () => {
      const server = new Deepstream()
      expect(server.convertTyped('N42')).toBe(42)
    })

    it('exposes constants as a static', () => {
      expect(Deepstream.constants).toBeDefined()
    })

    it('sets a supported option', () => {
      const server = new Deepstream()
      expect(() => {
        server.set('serverName', 'my lovely horse')
      }).not.toThrow()
    })

    it('sets an unsupported option', () => {
      const server = new Deepstream()
      expect(() => {
        server.set('gibberish', 4444)
      }).toThrow()
    })
  })

  xdescribe('it starts and stops the server', () => {
    let server

    it('starts the server twice', (next) => {
      server = new Deepstream({ showLogo: false })
      server.set('logger', new LoggerMock())
      server.on('started', () => {
        try {
          server.start()
          next.fail('should fail to start deepstream twice')
        } catch (err) {
          expect(err.toString()).toContain('can only start after it stops successfully')
          next()
        }
      })
      expect(server.isRunning()).toBe(false)
      server.start()
    })

    // NOTE: depends on test before
    it('stops the server', (next) => {
      expect(server.isRunning()).toBe(true)
      server.on('stopped', () => {
        expect(server.isRunning()).toBe(false)
        try {
          server.stop()
          next.fail('should fail to stop deepstream twice')
        } catch (err) {
          expect(err.toString()).toContain('server is already stopped')
          next()
        }
      })
      server.stop()
    })

    // NOTE: depends on the test before
    it('start the server again from the same instance', (next) => {
      server.on('started', server.stop)
      server.on('stopped', next)
      server.start()
    })
  })

  xdescribe('it handle calling start and stop twice', () => {
    let server

    it('starts the server', (next) => {
      server = new Deepstream({ showLogo: false })
      server.set('logger', new LoggerMock())
      server.on('started', next)
      expect(server.isRunning()).toBe(false)
      server.start()
    })

    it('stops the server', (next) => {
      expect(server.isRunning()).toBe(true)
      server.on('stopped', next)
      server.stop()
    })

    it('has stopped the server', () => {
      expect(server.isRunning()).toBe(false)
    })
  })

  xdescribe('it starts and stops a configured server', () => {
    let server
    let logger

    beforeEach(() => {
      server = new Deepstream()
      logger = new ClosableLogger()
      server.set('showLogo', false)
      server.set('logger', logger)
    })

    afterEach((next) => {
      if (server.isRunning()) {
        server.on('stopped', next)
        server.stop()
      } else {
        next()
      }
    })

    it('starts and stops the server', (next) => {
      expect(server.isRunning()).toBe(false)
      server.on('started', () => {
        expect(server.isRunning()).toBe(true)
        server.on('stopped', () => {
          expect(server.isRunning()).toBe(false)
          next()
        })
        server.stop()
      })
      server.start()
    })

    it('encounters a logger error', (next) => {
      server.on('started', () => {
        server._options.logger.emit('error', 'test error')
        expect(logger.log.calls.mostRecent().args[2]).toBe('Error from logger plugin: test error')
        next()
      })
      server.start()
    })
    it('encounters a plugin error', (next) => {
      const fakeCloseablePlugin = new ClosableLogger()
      server.set('cache', fakeCloseablePlugin)
      server.on('started', () => {
        fakeCloseablePlugin.emit('error', 'test error')
      // TODO: why fakeCloseablePlugin contains console args?
        expect(logger.log.calls.mostRecent().args[2]).toBe('Error from cache plugin: test error')
        expect(fakeCloseablePlugin.log.calls.mostRecent().args[2]).toBe('Error from cache plugin: test error')
        next()
      })
      server.start()
    })

    it('should merge the options with default values', (next) => {
      server = new Deepstream({ showLogo: false, permission: { type: 'none' } })
      server.set('logger', logger)
      server.on('started', () => {
        expect(server.isRunning()).toBe(true)
        next()
      })
      server.start()
    })

    it('which handles health checks', (next) => {
      server = new Deepstream({
        showLogo: false,
        permission: { type: 'none' },
        healthCheckPath: '/health-check'
      })
      server.set('logger', logger)
      server.on('started', () => {
        http.get({ host: 'localhost', port: 6020, path: '/health-check' }, (res) => {
          expect(res.statusCode).toBe(200)
          next()
        })
      })
      server.start()
    })
  })

// this fails when a config file is present in /usr/local/etc/deepstream/conf
  xdescribe('handle server startup without config file', () => {
    const cwd = path.resolve('./bin')
    const execOptions = {
      cwd,
      stdio: ['ignore', 'ignore', 'pipe']
    }
    it('via CLI', (done) => {
      try {
        child_process.execSync('node deepstream start', execOptions)
      } catch (err) {
        const stderr = err.stderr.toString()
        expect(stderr).toContain('No config file found')
        done()
      }
    })
    it('via API', (done) => {
      const server = new Deepstream()
      const logger = new ClosableLogger()
      server.set('showLogo', false)
      server.set('logger', logger)
      server._configFile = null
      server.on('stopped', done)
      server.on('started', server.stop)
      server.start()
    })
  })

})
