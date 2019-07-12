import 'mocha'
import { expect } from 'chai'

import * as C from '../../../constants'

import { getBasePermissions } from '../../../test/helper/test-helper'
import * as testHelper from '../../../test/helper/test-helper'

const options = testHelper.getDeepstreamPermissionOptions()
const services = options.services
const testPermission = testHelper.testPermission(options)

describe('allows to create a record without providing data, but denies updating it', () => {
  const permissions = getBasePermissions()
  permissions.record['some/*'] = {
    write: 'data.name === "Wolfram"'
  }

  beforeEach(() => {
    services.cache.set('some/tests', 0, {}, () => {})
  })

  it('allows creating the record', () => {
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.SUBSCRIBECREATEANDREAD,
      name: 'some/tests'
    }

    expect(testPermission(permissions, message)).to.equal(true)
  })

  it('denies update', () => {
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.UPDATE,
      name: 'some/tests',
      version: 2,
      data: '{"other":"data"}'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(false)
    }

    testPermission(permissions, message, 'some-user', null, callback)
  })

  it('denies patch', () => {
    const message = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTION.PATCH,
      name: 'some/tests',
      version: 2,
      path: 'apath',
      data: '"aValue"'
    }

    const callback = function (socketWrapper, msg, passItOn, error, result) {
      expect(error).to.equal(null)
      expect(result).to.equal(false)
    }

    testPermission(permissions, message, 'some-user', null, callback)
  })
})
