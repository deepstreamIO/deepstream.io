import 'mocha'
import { expect } from 'chai'

import { OpenPermission } from './open-permission'

describe('open permission handler', () => {
  let permission

  it('allows any action', (done) => {
    permission = new OpenPermission()

    const message = {
      topic: 'This doesnt matter',
      action: 'Since it allows anything',
      data: ['anything']
    }
    permission.canPerformAction('someone', message, (socketWrapper, msg, passItOn, error, success) => {
      expect(error).to.equal(null)
      expect(success).to.equal(true)
      done()
    }, {})
  })
})
