/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const configCompiler = require('../../src/permission/config-compiler')

describe('compiles user entered config specs into an optimized format', () => {
  it('exposes a compile method', () => {
    expect(typeof configCompiler.compile).toBe('function')
  })

  it('compiles a basic config', () => {
    const conf = {
      record: {
        'user/$userId': {
          write: '$userId === user.id'
        }
      }
    }

    const compiledConf = configCompiler.compile(conf)

    expect(Array.isArray(compiledConf.record)).toBe(true)
    expect(compiledConf.record.length).toBe(1)
    expect(compiledConf.record[0].regexp).toBeDefined()
    expect(compiledConf.record[0].variables).toEqual(['$userId'])
    expect(compiledConf.record[0].rules.write.fn).toBeDefined()
    expect(compiledConf.record[0].rules.write.hasOldData).toBe(false)
  })
})
