import 'mocha'
import { expect } from 'chai'
import {spy, assert} from 'sinon'
import * as C from '../../../constants'
import { ConfigPermission } from './config-permission'
import * as testHelper from '../../../test/helper/test-helper'
import { EVENT } from '../../../constants';
import { PromiseDelay } from '../../../utils/utils';

const { config, services } = testHelper.getDeepstreamPermissionOptions()

const recordHandler = {
  removeRecordRequest: () => {},
  runWhenRecordStable: (r, c) => { c(r) }
}

describe('permission handler loading', () => {
  beforeEach(() => {
    services.logger.fatal = spy()
  })

  describe('permission handler is initialised correctly', () => {
    it('loads a valid config file upon initialisation', async () => {
      const permission = new ConfigPermission({
        path: './conf/permissions.yml',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)
      assert.notCalled(services.logger.fatal)
      permission.init()
      await permission.whenReady()
    })

    it('fails to load maxRuleIterations less than zero initialisation', async () => {
      const permission = new ConfigPermission({
        path: './conf/permissions.yml',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 0
      }, services, config)

      permission.init()

      assert.calledOnce(services.logger.fatal)
      assert.calledWithExactly(services.logger.fatal, EVENT.PLUGIN_INITIALIZATION_ERROR, 'Maximum rule iteration has to be at least one')
    })

    it('fails to load a non existant config file upon initialisation', async () => {
      const permission = new ConfigPermission({
        path: './does-not-exist.yml',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)

      permission.init()

      await PromiseDelay(0)

      assert.calledOnce(services.logger.fatal)
      assert.calledWithExactly(services.logger.fatal, EVENT.PLUGIN_INITIALIZATION_ERROR, 'error while loading config at ./does-not-exist.yml')
    })

    it('fails when loading an invalid config file upon initialisation', async () => {
      const permission = new ConfigPermission({
        path: './src/test/config/invalid-permission-conf.json',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)

      permission.init()

      await PromiseDelay(10)

      assert.calledOnce(services.logger.fatal)
      assert.calledWithExactly(services.logger.fatal, EVENT.PLUGIN_INITIALIZATION_ERROR, 'invalid permission config - empty section "record"')
    })
  })

  describe('it loads a new config during runtime', () => {
    let permission
    const onError = spy()

    it('loads a valid config file upon initialisation', async () => {
      permission = new ConfigPermission({
        path: './conf/permissions.yml',
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)
      permission.init()

      await permission.whenReady()
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

      permission.emitter.on('config-loaded', (loadedPath) => {
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
