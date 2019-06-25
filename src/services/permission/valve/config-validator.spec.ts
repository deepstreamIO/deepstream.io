import 'mocha'
import { expect } from 'chai'

import * as configValidator from './config-validator'
import * as testHelper from '../../../test/helper/test-helper'

describe('it validates permission.json files', () => {
  it('exposes a validate method', () => {
    expect(typeof configValidator.validate).to.equal('function')
  })

  it('validates a basic configuration', () => {
    expect(configValidator.validate(testHelper.getBasePermissions())).to.equal(true)
  })

  it('validates the type of the configuration', () => {
    expect(configValidator.validate()).to.equal('config should be an object literal, but was of type undefined')
    expect(configValidator.validate('bla')).to.equal('config should be an object literal, but was of type string')
    expect(configValidator.validate(testHelper.getBasePermissions())).to.equal(true)
  })

  it('fails if a top level key is missing', () => {
    const conf = testHelper.getBasePermissions()
    delete conf.record
    expect(configValidator.validate(conf)).to.equal('missing configuration section "record"')
  })

  it('fails if an unknown top level key is added', () => {
    const conf = testHelper.getBasePermissions()
    conf.bogus = {}
    expect(configValidator.validate(conf)).to.equal('unexpected configuration section "bogus"')
  })

  it('fails for empty sections', () => {
    const conf = testHelper.getBasePermissions()
    conf.rpc = {}
    expect(configValidator.validate(conf)).to.equal('empty section "rpc"')
  })

  it('fails if no root permissions are specified', () => {
    const conf = testHelper.getBasePermissions()
    conf.rpc = { bla: {
      request: 'user.id === $userId'
    } }
    expect(configValidator.validate(conf)).to.equal('missing root entry "*" for section rpc')
  })

  it('fails for invalid paths', () => {
    const conf = testHelper.getBasePermissions()
    conf.record.a$$x = {}
    expect(configValidator.validate(conf)).to.equal('invalid variable name $$ for path a$$x in section record')
  })

  it('fails for invalid rule types', () => {
    const conf = testHelper.getBasePermissions()
    conf.rpc.somepath = { write: 'a === b' }
    expect(configValidator.validate(conf)).to.equal('unknown rule type write in section rpc')
  })

  it('fails for invalid rules', () => {
    const conf = testHelper.getBasePermissions()
    conf.record.somepath = { write: 'process.exit()' }
    expect(configValidator.validate(conf)).to.equal('function exit is not supported')
  })

  // it( 'fails for rules referencing data that dont support it', function(){
  //  var conf = testHelper.getBasePermissions();
  //  conf.record.somepath = { read: 'data.firstname === "Egon"' };
  //  expect( configValidator.validate( conf ) ).to.equal(
  //    'data is not supported for record read - did you mean "oldData"?' \
  //  );
  // });
})
