import 'mocha'
import { expect } from 'chai'
import {spy} from 'sinon'
import * as C from '../../../constants'
import { ConfigPermission } from './config-permission'
import * as testHelper from '../../../test/helper/test-helper'

const { config, services } = testHelper.getDeepstreamPermissionOptions()

const recordHandler = {
  removeRecordRequest: () => {},
  runWhenRecordStable: (r, c) => { c(r) }
}

describe('permission handler loading', () => {
  describe('permission handler is initialised correctly', () => {
    it('loads a valid config file upon initialisation', (next) => {
      const permission = new ConfigPermission({
        path: './conf/permissions.yml',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)
      permission.on('error', (error) => {
        expect(`it should not have had this ${error}`).to.equal('true')
        next()
      })
      permission.on('ready', () => {
        expect(permission.isReady).to.equal(true)
        next()
      })
      permission.setRecordHandler(recordHandler)
      expect(permission.isReady).to.equal(false)
      permission.init()
    })

    it('fails to load maxRuleIterations less than zero initialisation', (next) => {
      const permission = new ConfigPermission({
        path: './conf/permissions.yml',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 0
      }, services, config)
      permission.setRecordHandler(recordHandler)
      permission.on('error', (error) => {
        expect(error).to.contain('Maximum rule iteration has to be at least one')
        next()
      })
      permission.on('ready', () => {
        next('should not have gotten here')
        next()
      })
      expect(permission.isReady).to.equal(false)
      permission.init()
    })

    it('fails to load a non existant config file upon initialisation', (next) => {
      const permission = new ConfigPermission({
        path: './does-not-exist.yml',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)
      permission.setRecordHandler(recordHandler)
      permission.on('error', (error) => {
        expect(error).to.contain('ENOENT')
        next()
      })
      permission.on('ready', () => {
        expect('should not have gotten here').to.equal('true')
        next()
      })
      expect(permission.isReady).to.equal(false)
      permission.init()
    })

    it('fails when loading an invalid config file upon initialisation', (next) => {
      const permission = new ConfigPermission({
        path: './src/test/config/invalid-permission-conf.json',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)
      permission.setRecordHandler(recordHandler)
      permission.on('error', (error) => {
        expect(error).to.equal('invalid permission config - empty section "record"')
        next()
      })
      permission.on('ready', () => {
        expect('should not have gotten here').to.equal('true')
        next()
      })
      expect(permission.isReady).to.equal(false)
      permission.init()
    })
  })

  describe('it loads a new config during runtime', () => {
    let permission
    const onError = spy()

    it('loads a valid config file upon initialisation', (next) => {
      permission = new ConfigPermission({
        path: './conf/permissions.yml',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)
      permission.setRecordHandler(recordHandler)
      permission.on('error', onError)
      permission.on('error', (error) => {
        expect(`it should not have had this ${error}`).to.equal('true')
        next()
      })
      permission.on('ready', () => {
        expect(permission.isReady).to.equal(true)
        next()
      })
      expect(permission.isReady).to.equal(false)
      permission.init()
    })

    it('allows publishing of a private event', (next) => {
      const message = {
        topic: C.TOPIC.EVENT,
        action: C.EVENT_ACTIONS.EMIT,
        name: 'private/event',
        data: 'somedata'
      }

      const callback = function (socketWrapper, msg, passItOn, error, result) {
        expect(error).to.equal(null)
        expect(result).to.equal(true)
        next()
      }

      permission.canPerformAction('some-user', message, callback)
    })

    it('loads a new config', (next) => {
      const path = './src/test/config/no-private-events-permission-config.json'

      permission.on('config-loaded', (loadedPath) => {
        expect(loadedPath).to.equal(path)
        setTimeout(next, 20)
      })

      permission.loadConfig(path)
    })

    it('denies publishing of a private event', (next) => {
      expect(onError).to.have.callCount(0)

      const message = {
        topic: C.TOPIC.EVENT,
        action: C.EVENT_ACTIONS.EMIT,
        name: 'private/event',
        data: 'somedata'
      }

      const callback = function (socketWrapper, msg, passItOn, error, result) {
        expect(error).to.equal(null)
        expect(result).to.equal(false)
        next()
      }

      permission.canPerformAction('some-user', message, callback)
    })
  })
})
