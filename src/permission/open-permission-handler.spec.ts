import 'mocha'
import { expect } from 'chai'

const PermissionHandler = require('./open-permission-handler').default

describe('open permission handler', () => {
  let permissionHandler

  it('allows any action', (done) => {
    permissionHandler = new PermissionHandler()

    const message = {
      topic: 'This doesnt matter',
      action: 'Since it allows anything',
      data: ['anything']
    }
    permissionHandler.canPerformAction('someone', message, (socketWrapper, msg, passItOn, error, success) => {
      expect(error).to.equal(null)
      expect(success).to.equal(true)
      done()
    }, {})
  })
})
