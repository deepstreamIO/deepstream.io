import 'mocha'
import { expect } from 'chai'

const RuleCache = require('./rule-cache').default

describe('loads and retrieves values from the rule cache', () => {
  let ruleCache

  it('creates the rule cache', () => {
    ruleCache = new RuleCache({ cacheEvacuationInterval: 10 })
    expect(ruleCache.has('record', '*', 'write')).to.equal(false)
  })

  it('sets a value', () => {
    ruleCache.set('event', '*', 'write', 'ah')
    expect(ruleCache.has('event', '*', 'write')).to.equal(true)
    expect(ruleCache.get('event', '*', 'write')).to.equal('ah')
  })

  it('sets another value', (next) => {
    ruleCache.set('record', '*', 'write', 'yup')
    expect(ruleCache.has('record', '*', 'write')).to.equal(true)
    expect(ruleCache.get('record', '*', 'write')).to.equal('yup')
    setTimeout(next, 40)
  })

  it('sets two values for different actions', () => {
    ruleCache.set('record', 'somepath', 'write', true)
    ruleCache.set('record', 'somepath', 'read', 'bla')

    expect(ruleCache.has('record', 'somepath', 'write')).to.equal(true)
    expect(ruleCache.get('record', 'somepath', 'write')).to.equal(true)

    expect(ruleCache.has('record', 'somepath', 'read')).to.equal(true)
    expect(ruleCache.get('record', 'somepath', 'read')).to.equal('bla')
  })

  it('has purged the cache in the meantime', () => {
    expect(ruleCache.has('record', '*', 'write')).to.equal(false)
  })

  it('does not remove an entry thats repeatedly requested', (next) => {
    ruleCache.set('record', '*', 'write', 'yeah')
    let count = 0
    const interval = setInterval(() => {
      count++
      expect(ruleCache.has('record', '*', 'write')).to.equal(true)
      expect(ruleCache.get('record', '*', 'write')).to.equal('yeah')
      if (count >= 10) {
        clearInterval(interval)
        next()
      }
    }, 10)
  })

  it('removes the entry once it stops being requested', (next) => {
    expect(ruleCache.has('record', '*', 'write')).to.equal(true)
    expect(ruleCache.get('record', '*', 'write')).to.equal('yeah')
    setTimeout(() => {
      expect(ruleCache.has('record', '*', 'write')).to.equal(false)
      next()
    }, 40)
  })
})
