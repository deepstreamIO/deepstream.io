/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const rulesMap = require('../../src/permission/rules-map')
const C = require('../../src/constants/constants')

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
      action: C.ACTIONS.UNSUBSCRIBE
    }
    expect(rulesMap.getRulesForMessage(msg)).toBe(null)
  })

  it('returns ruletypes for event subscribe messages', () => {
    const msg = {
      topic: C.TOPIC.EVENT,
      action: C.ACTIONS.SUBSCRIBE
    }
    expect(rulesMap.getRulesForMessage(msg)).toEqual({
      section: 'event',
      type: 'subscribe',
      action: 'SUBSCRIBE'
    })
  })

  it('returns ruletypes for record patch messages', () => {
    const msg = {
      topic: C.TOPIC.RECORD,
      action: C.ACTIONS.PATCH
    }
    expect(rulesMap.getRulesForMessage(msg)).toEqual({
      section: 'record',
      type: 'write',
      action: 'PATCH'
    })
  })
})
