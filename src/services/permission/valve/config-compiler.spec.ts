import 'mocha'
import { expect } from 'chai'
const configCompiler = require('./config-compiler')

describe('compiles user entered config specs into an optimized format', () => {
  it('exposes a compile method', () => {
    expect(typeof configCompiler.compile).to.equal('function')
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

    expect(Array.isArray(compiledConf.record)).to.equal(true)
    expect(compiledConf.record.length).to.equal(1)
    expect(compiledConf.record[0].regexp).to.not.equal(undefined)
    expect(compiledConf.record[0].variables).to.deep.equal(['$userId'])
    expect(compiledConf.record[0].rules.write.fn).to.not.equal(undefined)
    expect(compiledConf.record[0].rules.write.hasOldData).to.equal(false)
  })
})
