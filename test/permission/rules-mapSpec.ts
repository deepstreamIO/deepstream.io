'use strict'

const rulesMap = require('../../src/permission/rules-map')
import * as C from '../../src/constants'

describe('returns the applicable rule for a message', () => {
  it('exposes a getRulesForMessage method', () => {
    expect(typeof rulesMap.getRulesForMessage).toBe('function')
  })

  it('returns null for topics without rules', () => {
    const msg = {
      topic: C.TOPIC.AUTH
    }
    expect(rulesMap.getRulesForMessage(msg)).toBe(null)
  })

  it('returns null for actions without rules', () => {
    const msg = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTIONS.UNSUBSCRIBE
    }
    expect(rulesMap.getRulesForMessage(msg)).toBe(null)
  })

  it('returns ruletypes for event subscribe messages', () => {
    const msg = {
      topic: C.TOPIC.EVENT,
      action: C.EVENT_ACTIONS.SUBSCRIBE
    }
    expect(rulesMap.getRulesForMessage(msg)).toEqual({
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
    expect(rulesMap.getRulesForMessage(msg)).toEqual({
      section: 'record',
      type: 'write',
      action: C.RECORD_ACTIONS.PATCH
    })
  })
})
