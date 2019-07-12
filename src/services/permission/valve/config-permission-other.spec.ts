import 'mocha'
import { expect } from 'chai'

import { getBasePermissions } from '../../../test/helper/test-helper'
import * as C from '../../../constants'
import * as testHelper from '../../../test/helper/test-helper'
import { ConfigPermission } from './config-permission';

const { config, services } = testHelper.getDeepstreamPermissionOptions()
const testPermission = testHelper.testPermission({ config, services })

describe('supports spaces after variables and escaped quotes', () => {
  it('errors for read with data', () => {
    const permissions = getBasePermissions()
    permissions.record.someUser = {
      read: 'data.firstname === "Yasser"',
      write: 'data .firstname === "Yasser"'
    }

    try {
      // tslint:disable-next-line:no-unused-expression
      new ConfigPermission(config, services, permissions)
    } catch (e) {
      expect(e.toString()).to.contain('invalid permission config - rule read for record does not support data')
    }
  })

  it('allows yasser', (next) => {
    const permissions = getBasePermissions()
    permissions.record.someUser = {
      write: 'data .firstname === "Yasser"'
    }
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'someUser',
      version: 1,
      data: '{"firstname":"Yasser"}'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(true)
      next()
    }

    testPermission(permissions, message, 'Yasser', null, callback)
  })

  it('denies Wolfram', (next) => {
    const permissions = getBasePermissions()
    permissions.record.someUser = {
      write: 'data .firstname === "Yasser"'
    }

    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'someUser',
      version: 1,
      data: '{"firstname":"Wolfram"}'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, 'Yasser', null, callback)
  })
})
