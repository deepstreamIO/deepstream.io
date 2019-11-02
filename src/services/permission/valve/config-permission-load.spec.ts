import 'mocha'
import { expect } from 'chai'
import {spy, assert} from 'sinon'
import * as C from '../../../constants'
import { ConfigPermission } from './config-permission'
import * as testHelper from '../../../test/helper/test-helper'
import { PromiseDelay } from '../../../utils/utils'
import { EVENT } from '@deepstream/types'

import * as invalidPermissionConfig from '../../../test/config/invalid-permission-conf.json'
import * as noPrivateEventsConfig from '../../../test/config/no-private-events-permission-config.json'

const { config, services } = testHelper.getDeepstreamPermissionOptions()

describe('permission handler loading', () => {
  beforeEach(() => {
    services.logger.fatal = spy()
  })

  describe('permission handler is initialised correctly', () => {
    it('loads a valid config file upon initialization', async () => {
      const permission = new ConfigPermission({
        permissions: testHelper.getBasePermissions(),
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)
      assert.notCalled(services.logger.fatal)
      await permission.whenReady()
    })

    it('fails to load maxRuleIterations less than zero initialization', async () => {
      const permission = new ConfigPermission({
        permissions: testHelper.getBasePermissions(),
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 0
      }, services, config)

      assert.calledOnce(services.logger.fatal)
      assert.calledWithExactly(services.logger.fatal, EVENT.PLUGIN_INITIALIZATION_ERROR, 'Maximum rule iteration has to be at least one')
    })

    it('fails when loading an invalid config file upon initialization', async () => {
      // tslint:disable-next-line: no-unused-expression
      new ConfigPermission({
        permissions: invalidPermissionConfig,
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)

      await PromiseDelay(10)

      assert.calledOnce(services.logger.fatal)
      assert.calledWithExactly(services.logger.fatal, EVENT.PLUGIN_INITIALIZATION_ERROR, 'invalid permission config - empty section "record"')
    })
  })

  describe('it loads a new config during runtime', () => {
    let permission: ConfigPermission
    const onError = spy()

    it('loads a valid config file upon initialization', async () => {
      permission = new ConfigPermission({
        permissions: testHelper.getBasePermissions(),
        cacheEvacuationInterval: 60000,
        maxRuleIterations: 10
      }, services, config)

      await permission.whenReady()
    })

    it('allows publishing of a private event', (next) => {
      const message = {
        topic: C.TOPIC.EVENT,
        action: C.EVENT_ACTION.EMIT,
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

    it('denies publishing of a private event', (next) => {
      expect(onError).to.have.callCount(0)

      const message = {
        topic: C.TOPIC.EVENT,
        action: C.EVENT_ACTION.EMIT,
        name: 'private/event',
        data: 'somedata'
      }

      const callback = function (socketWrapper, msg, passItOn, error, result) {
        expect(error).to.equal(null)
        expect(result).to.equal(false)
        next()
      }

      permission.useConfig(noPrivateEventsConfig)
      permission.canPerformAction('some-user', message, callback, {})
    })
  })
})
