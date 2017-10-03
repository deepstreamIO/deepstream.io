/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ruleParser = require('../../src/permission/rule-parser')

describe('validates rule strings from permissions.json', () => {
  it('exposes a validate method', () => {
    expect(typeof ruleParser.validate).toBe('function')
  })

  it('accepts valid rules', () => {
    expect(ruleParser.validate('user.id === $userId')).toBe(true)
  })

  it('rejects non-strings', () => {
    expect(ruleParser.validate(3)).toBe('rule must be a string')
  })

  it('rejects empty strings', () => {
    expect(ruleParser.validate('')).toBe('rule can\'t be empty')
  })

  it('rejects rules that contain new as a keyword', () => {
    expect(ruleParser.validate('a new SomeClass')).toBe('rule can\'t contain the new keyword')
    expect(ruleParser.validate('a=new SomeClass')).toBe('rule can\'t contain the new keyword')
    expect(ruleParser.validate('new SomeClass')).toBe('rule can\'t contain the new keyword')
    expect(ruleParser.validate(' new SomeClass')).toBe('rule can\'t contain the new keyword')
    expect(ruleParser.validate('16-new Number(3)')).toBe('rule can\'t contain the new keyword')
    expect(ruleParser.validate('~new SomeClass')).toBe('rule can\'t contain the new keyword')
  })

  it('accepts rules that contain new as part of another string or object name', () => {
    expect(ruleParser.validate('newData.firstname')).toBe(true)
    expect(ruleParser.validate('$new = "foo"')).toBe(true) // TODO also unicode in identifiers
    // expect(ruleParser.validate('a == "new"')).toBe(true) // TODO
  })

  it('rejects rules that define user functions', () => {
    expect(ruleParser.validate('(function (foo) { return foo + 1; })(20)'))
      .toBe('rule can\'t contain user functions')
    expect(ruleParser.validate('(foo => foo + 1)(20)')).toBe('rule can\'t contain user functions')
  })

  it('rejects rules that call unsupported functions', () => {
    expect(ruleParser.validate('data.lastname.toUpperCase()', 'record', 'write')).toBe(true)
    expect(ruleParser.validate('alert("bobo")')).toBe('function alert is not supported')
    expect(ruleParser.validate('alert  ("whoops") && console.log("nope")'))
      .toBe('function alert is not supported')
    expect(ruleParser.validate('alert\t("whoops")')).toBe('function alert is not supported')
    expect(ruleParser.validate('alert\n("whoops")')).toBe('function alert is not supported')
    expect(ruleParser.validate('console["log"]("whoops")'))
      .toBe('function log"] is not supported')
    expect(ruleParser.validate('global["con"+"sole"]["lo" + `g`] ("whoops")'))
      .toBe('function g`] is not supported')
    expect(ruleParser.validate('data.lastname.toUpperCase() && data.lastname.substr(0,3)', 'record', 'write')).toBe('function substr is not supported')
  })

  it('rejects invalid cross references', () => {
    expect(ruleParser.validate('_("another-record" + data.userId) === $userId', 'record', 'write')).toBe(true)
  })

  it('rejects rules that are syntactiacally invalid', () => {
    expect(ruleParser.validate('a b')).toBe('SyntaxError: Unexpected identifier')
    expect(ruleParser.validate('user.id.toUpperCase(')).toBe('SyntaxError: Unexpected token }')
  })

  it('rejects rules that reference old data without it being supported', () => {
    expect(ruleParser.validate('data.price === 500 && oldData.price < 500', 'event', 'publish')).toBe('rule publish for event does not support oldData')
  })

  it('rejects rules that reference data without it being supported', () => {
    expect(ruleParser.validate('user.id === $userId && data.price === 500', 'rpc', 'provide')).toBe('rule provide for rpc does not support data')
  })

  it('validates a rule referencing data as a property for a type (read) where the injected (root) data is not available', () => {
    const validatedRule = ruleParser.validate('user.id !== user.data.someUser', 'record', 'read')
    expect(typeof validatedRule).toBe('boolean')
    expect(validatedRule).toBe(true)
  })
})

describe('compiles rules into usable objects', () => {
  it('compiles boolean false', () => {
    const compiledRule = ruleParser.parse(false, [])
    expect(compiledRule.fn()).toBe(false)
    expect(typeof compiledRule.fn).toBe('function')
    expect(compiledRule.hasOldData).toBe(false)
    expect(compiledRule.hasData).toBe(false)
  })

  it('compiles boolean true', () => {
    const compiledRule = ruleParser.parse(true, [])
    expect(compiledRule.fn()).toBe(true)
    expect(typeof compiledRule.fn).toBe('function')
    expect(compiledRule.hasOldData).toBe(false)
    expect(compiledRule.hasData).toBe(false)
  })

  it('creates executable functions', () => {
    expect(ruleParser.parse('"bobo"', []).fn()).toBe('bobo')
    expect(ruleParser.parse('2+2', []).fn()).toBe(4)
  })

  it('compiles a simple rule', () => {
    const compiledRule = ruleParser.parse('user.id !== "open"', [])
    expect(typeof compiledRule.fn).toBe('function')
    expect(compiledRule.hasOldData).toBe(false)
    expect(compiledRule.hasData).toBe(false)
  })

  it('compiles a rule referencing data', () => {
    const compiledRule = ruleParser.parse('user.id !== data.someUser', [])
    expect(typeof compiledRule.fn).toBe('function')
    expect(compiledRule.hasOldData).toBe(false)
    expect(compiledRule.hasData).toBe(true)
  })

  it('compiles a rule referencing data followed by a space', () => {
    const compiledRule = ruleParser.parse('data .firstname === "Yasser"', [])
    expect(typeof compiledRule.fn).toBe('function')
    expect(compiledRule.hasOldData).toBe(false)
    expect(compiledRule.hasData).toBe(true)
  })

  it('compiles a rule referencing oldData', () => {
    const compiledRule = ruleParser.parse('user.id !== oldData.someUser', [])
    expect(typeof compiledRule.fn).toBe('function')
    expect(compiledRule.hasOldData).toBe(true)
    expect(compiledRule.hasData).toBe(false)
  })

  it('compiles a rule referencing both data and oldData', () => {
    const compiledRule = ruleParser.parse('user.id !== data.someUser && oldData.price <= data.price', [])
    expect(typeof compiledRule.fn).toBe('function')
    expect(compiledRule.hasOldData).toBe(true)
    expect(compiledRule.hasData).toBe(true)
  })

  it('compiles a rule referencing both data and oldData as well as other records', () => {
    const compiledRule = ruleParser.parse('_( "private/"+ user.id ) !== data.someUser && oldData.price <= data.price', [])
    expect(typeof compiledRule.fn).toBe('function')
    expect(compiledRule.hasOldData).toBe(true)
    expect(compiledRule.hasData).toBe(true)
  })
})
