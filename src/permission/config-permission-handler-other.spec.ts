import 'mocha'
import { expect } from 'chai'

const getBasePermissions = require('../test/helper/test-helper').getBasePermissions
import * as C from '../constants'
const testHelper = require('../test/helper/test-helper')
const ConfigPermissionHandler = require('./config-permission-handler').default

const options = testHelper.getDeepstreamPermissionOptions()
const config = options.config
const testPermission = testHelper.testPermission(options)

describe('supports spaces after variables and escaped quotes', () => {
  it('errors for read with data', () => {
    const permissions = getBasePermissions()
    permissions.record.someUser = {
      read: 'data.firstname === "Yasser"',
      write: 'data .firstname === "Yasser"'
    }

    try {
      // tslint:disable-next-line:no-unused-expression
      new ConfigPermissionHandler(config, {}, permissions)
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
      action: C.RECORD_ACTIONS.UPDATE,
      name: 'someUser',
      version: 1,
      data: '{"firstname":"Yasser"}'
    }

    const callback = function (error, result) {
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
      action: C.RECORD_ACTIONS.UPDATE,
      name: 'someUser',
      version: 1,
      data: '{"firstname":"Wolfram"}'
    }

    const callback = function (error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(false)
      next()
    }

    testPermission(permissions, message, 'Yasser', null, callback)
  })
})
