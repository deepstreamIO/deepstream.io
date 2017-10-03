/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const configValidator = require('../../src/permission/config-validator')
const testHelper = require('../test-helper/test-helper')

describe('it validates permission.json files', () => {
  it('exposes a validate method', () => {
    expect(typeof configValidator.validate).toBe('function')
  })

  it('validates a basic configuration', () => {
    expect(configValidator.validate(testHelper.getBasePermissions())).toBe(true)
  })

  it('validates the type of the configuration', () => {
    expect(configValidator.validate()).toBe('config should be an object literal, but was of type undefined')
    expect(configValidator.validate('bla')).toBe('config should be an object literal, but was of type string')
    expect(configValidator.validate(testHelper.getBasePermissions())).toBe(true)
  })

  it('fails if a top level key is missing', () => {
    const conf = testHelper.getBasePermissions()
    delete conf.record
    expect(configValidator.validate(conf)).toBe('missing configuration section "record"')
  })

  it('fails if an unknown top level key is added', () => {
    const conf = testHelper.getBasePermissions()
    conf.bogus = {}
    expect(configValidator.validate(conf)).toBe('unexpected configuration section "bogus"')
  })

  it('fails for empty sections', () => {
    const conf = testHelper.getBasePermissions()
    conf.rpc = {}
    expect(configValidator.validate(conf)).toBe('empty section "rpc"')
  })

  it('fails if no root permissions are specified', () => {
    const conf = testHelper.getBasePermissions()
    conf.rpc = { bla: {
      request: 'user.id === $userId'
    } }
    expect(configValidator.validate(conf)).toBe('missing root entry "*" for section rpc')
  })

  it('fails for invalid paths', () => {
    const conf = testHelper.getBasePermissions()
    conf.record.a$$x = {}
    expect(configValidator.validate(conf)).toBe('invalid variable name $$ for path a$$x in section record')
  })

  it('fails for invalid rule types', () => {
    const conf = testHelper.getBasePermissions()
    conf.rpc.somepath = { write: 'a === b' }
    expect(configValidator.validate(conf)).toBe('unknown rule type write in section rpc')
  })

  it('fails for invalid rules', () => {
    const conf = testHelper.getBasePermissions()
    conf.record.somepath = { write: 'process.exit()' }
    expect(configValidator.validate(conf)).toBe('function exit is not supported')
  })

  // it( 'fails for rules referencing data that dont support it', function(){
  //  var conf = testHelper.getBasePermissions();
  //  conf.record.somepath = { read: 'data.firstname === "Egon"' };
  //  expect( configValidator.validate( conf ) ).toBe(
  //    'data is not supported for record read - did you mean "oldData"?' \
  //  );
  // });
})
