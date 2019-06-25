import 'mocha'
import { expect } from 'chai'

import { getRulesForMessage } from './rules-map'
import * as C from '../../../constants'

describe('returns the applicable rule for a message', () => {
  it('exposes a getRulesForMessage method', () => {
    expect(typeof getRulesForMessage).to.equal('function')
  })

  it('returns null for topics without rules', () => {
    const msg = {
      topic: C.TOPIC.AUTH
    }
    expect(getRulesForMessage(msg)).to.equal(null)
  })

  it('returns null for actions without rules', () => {
    const msg = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTIONS.UNSUBSCRIBE
    }
    expect(getRulesForMessage(msg)).to.equal(null)
  })

  it('returns ruletypes for event subscribe messages', () => {
    const msg = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTIONS.SUBSCRIBE
    }
    expect(getRulesForMessage(msg)).to.deep.equal({
      section: 'event',
      type: 'subscribe',
      action: C.EVENT_ACTIONS.SUBSCRIBE
    })
  })

  it('returns ruletypes for record patch messages', () => {
    const msg = {
      topic: C.TOPIC.RECORD,
      action: C.RECORD_ACTIONS.PATCH
    }
    expect(getRulesForMessage(msg)).to.deep.equal({
      section: 'record',
      type: 'write',
      action: C.RECORD_ACTIONS.PATCH
    })
  })
})
