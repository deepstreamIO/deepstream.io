/* global fail, jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ConfigPermissionHandler = require('../../src/permission/config-permission-handler')
const C = require('../../src/constants/constants')

const recordHandler = {
  removeRecordRequest: () => {},
  runWhenRecordStable: (r, c) => { c(r) }
}

describe('permission handler loading', () => {
  describe('permission handler is initialised correctly', () => {
    it('loads a valid config file upon initialisation', (next) => {
      const permissionHandler = new ConfigPermissionHandler({
        permission: {
          options: {
            path: './conf/permissions.yml',
            cacheEvacuationInterval: 60000
          }
        }
      })
      permissionHandler.on('error', (error) => {
        expect(`it should not have had this ${error}`).toBe(true)
        next()
      })
      permissionHandler.on('ready', () => {
        expect(permissionHandler.isReady).toBe(true)
        next()
      })
      permissionHandler.setRecordHandler(recordHandler)
      expect(permissionHandler.isReady).toBe(false)
      permissionHandler.init()
    })

    it('fails to load maxRuleIterations less than zero initialisation', (next) => {
      const permissionHandler = new ConfigPermissionHandler({
        permission: {
          options: {
            path: './conf/permissions.yml',
            cacheEvacuationInterval: 60000,
            maxRuleIterations: 0
          }
        }
      })
      permissionHandler.setRecordHandler(recordHandler)
      permissionHandler.on('error', (error) => {
        expect(error).toContain('Maximum rule iteration has to be at least one')
        next()
      })
      permissionHandler.on('ready', () => {
        fail('should not have gotten here')
        next()
      })
      expect(permissionHandler.isReady).toBe(false)
      permissionHandler.init()
    })

    it('fails to load a non existant config file upon initialisation', (next) => {
      const permissionHandler = new ConfigPermissionHandler({
        permission: {
          options: {
            path: './does-not-exist.yml',
            cacheEvacuationInterval: 60000
          }
        }
      })
      permissionHandler.setRecordHandler(recordHandler)
      permissionHandler.on('error', (error) => {
        expect(error).toContain('ENOENT')
        next()
      })
      permissionHandler.on('ready', () => {
        expect('should not have gotten here').toBe(true)
        next()
      })
      expect(permissionHandler.isReady).toBe(false)
      permissionHandler.init()
    })

    it('fails when loading a broken config file upon initialisation', (next) => {
      const permissionHandler = new ConfigPermissionHandler({
        permission: {
          options: {
            path: './test/test-configs/broken-json-config.json',
            cacheEvacuationInterval: 60000
          }
        }
      })
      permissionHandler.setRecordHandler(recordHandler)
      permissionHandler.on('error', (error) => {
        expect(error).toContain('SyntaxError')
        next()
      })
      permissionHandler.on('ready', () => {
        expect('should not have gotten here').toBe(true)
        next()
      })
      expect(permissionHandler.isReady).toBe(false)
      permissionHandler.init()
    })

    it('fails when loading an invalid config file upon initialisation', (next) => {
      const permissionHandler = new ConfigPermissionHandler({
        permission: {
          options: {
            path: './test/test-configs/invalid-permission-conf.json',
            cacheEvacuationInterval: 60000
          }
        }
      })
      permissionHandler.setRecordHandler(recordHandler)
      permissionHandler.on('error', (error) => {
        expect(error).toBe('invalid permission config - empty section "record"')
        next()
      })
      permissionHandler.on('ready', () => {
        expect('should not have gotten here').toBe(true)
        next()
      })
      expect(permissionHandler.isReady).toBe(false)
      permissionHandler.init()
    })
  })

  describe('it loads a new config during runtime', () => {
    let permissionHandler
    const onError = jasmine.createSpy('error')

    it('loads a valid config file upon initialisation', (next) => {
      permissionHandler = new ConfigPermissionHandler({
        permission: {
          options: {
            path: './conf/permissions.yml',
            cacheEvacuationInterval: 60000
          }
        }
      })
      permissionHandler.setRecordHandler(recordHandler)
      permissionHandler.on('error', onError)
      permissionHandler.on('error', (error) => {
        expect(`it should not have had this ${error}`).toBe(true)
        next()
      })
      permissionHandler.on('ready', () => {
        expect(permissionHandler.isReady).toBe(true)
        next()
      })
      expect(permissionHandler.isReady).toBe(false)
      permissionHandler.init()
    })

    it('allows publishing of a private event', (next) => {
      const message = {
        topic: C.TOPIC.EVENT,
        action: C.ACTIONS.EVENT,
        data: ['private/event', 'somedata']
      }

      const callback = function (error, result) {
        expect(error).toBe(null)
        expect(result).toBe(true)
        next()
      }

      permissionHandler.canPerformAction('some-user', message, callback)
    })

    it('loads a new config', (next) => {
      const path = './test/test-configs/no-private-events-permission-config.json'

      permissionHandler.on('config-loaded', (loadedPath) => {
        expect(loadedPath).toBe(path)
        setTimeout(next, 20)
      })

      permissionHandler.loadConfig(path)
    })

    it('denies publishing of a private event', (next) => {
      expect(onError).not.toHaveBeenCalled()

      const message = {
        topic: C.TOPIC.EVENT,
        action: C.ACTIONS.EVENT,
        data: ['private/event', 'somedata']
      }

      const callback = function (error, result) {
        expect(error).toBe(null)
        expect(result).toBe(false)
        next()
      }

      permissionHandler.canPerformAction('some-user', message, callback)
    })
  })
})
