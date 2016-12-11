/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const PermissionHandler = require('../../src/permission/open-permission-handler')

describe('open permission handler', () => {
  let permissionHandler

  it('creates the handler', () => {
    permissionHandler = new PermissionHandler()
    expect(typeof permissionHandler.canPerformAction).toBe('function')
    expect(permissionHandler.type).toBe('none')
  })

  it('allows any action', (done) => {
    const message = {
      topic: 'This doesnt matter',
      action: 'Since it allows anything',
      data: ['anything']
    }
    permissionHandler.canPerformAction('someone', message, (error, success) => {
      expect(error).toBeNull()
      expect(success).toBe(true)
      done()
    }, {})
  })
})
