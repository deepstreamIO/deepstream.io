import 'mocha'
import { expect } from 'chai'

import * as pathParser from './path-parser'

const isRegExp = function (val) {
  return typeof val === 'object' && typeof val.test === 'function'
}

describe('validates paths in permission.json files', () => {
  it('exposes a validate method', () => {
    expect(typeof pathParser.validate).to.equal('function')
  })

  it('accepts a valid path', () => {
    expect(pathParser.validate('game-comment/$gameId/*')).to.equal(true)
  })

  it('rejects none strings', () => {
    expect(pathParser.validate(3 as any)).to.equal('path must be a string')
  })

  it('rejects empty strings', () => {
    expect(pathParser.validate('')).to.equal('path can\'t be empty')
  })

  it('rejects paths starting with /', () => {
    expect(pathParser.validate('/bla')).to.equal('path can\'t start with /')
  })

  it('rejects paths with invalid variable names', () => {
    expect(pathParser.validate('bla/$-')).to.equal('invalid variable name $-')
    expect(pathParser.validate('bla/$$aa')).to.equal('invalid variable name $$')
  })
})

describe('parses valid paths in permission.json files', () => {
  it('exposes a parse method', () => {
    expect(typeof pathParser.parse).to.equal('function')
  })

  it('parses a simple, valid path', () => {
    const result = pathParser.parse('i-am-valid')
    expect(isRegExp(result.regexp)).to.equal(true)
    expect(result.regexp.toString()).to.equal('/^i-am-valid$/')
    expect(result.variables.length).to.equal(0)
  })

  it('parses a valid path with a wildcard', () => {
    const result = pathParser.parse('i-am-valid/*')
    expect(isRegExp(result.regexp)).to.equal(true)
    expect(result.regexp.toString()).to.equal('/^i-am-valid\\/.*$/')
    expect(result.variables.length).to.equal(0)
  })

  it('parses a valid path with a variable', () => {
    const result = pathParser.parse('game-score/$gameId')
    expect(isRegExp(result.regexp)).to.equal(true)
    expect(result.regexp.toString()).to.equal('/^game-score\\/([^\/]+)$/')
    expect(result.variables).to.deep.equal(['$gameId'])
  })

  it('parses a valid path with multiple variables', () => {
    const result = pathParser.parse('game-comment/$gameId/$userId/$commentId')
    expect(isRegExp(result.regexp)).to.equal(true)
    expect(result.regexp.toString()).to.equal('/^game-comment\\/([^/]+)\\/([^/]+)\\/([^/]+)$/')
    expect(result.variables).to.deep.equal(['$gameId', '$userId', '$commentId'])
  })

  it('parses a path with a mix of variables and wildcards', () => {
    const result = pathParser.parse('$recordName/*')
    expect(isRegExp(result.regexp)).to.equal(true)
    expect(result.regexp.toString()).to.equal('/^([^/]+)\\/.*$/')
    expect(result.variables).to.deep.equal(['$recordName'])
  })
})

describe('applies regexp to paths', () => {
  it('applies a regexp to a simple path', () => {
    const path = 'public/*'
    const result = pathParser.parse(path)
    expect(result.regexp.test('public/details/info')).to.equal(true)
    expect(result.regexp.test('private/details/info')).to.equal(false)
  })

  it('applies a regexp and extracts a variable from a simple path', () => {
    const path = 'private/$userId'
    const name = 'private/userA'
    const result = pathParser.parse(path)
    expect(result.regexp.test(name)).to.equal(true)

    const r = name.match(result.regexp) || false
    expect(r[1]).to.equal('userA')
  })

  it('applies a regexp and extracts variables from a more complex path', () => {
    const path = 'private/$userId/*/$anotherId'
    const name = 'private/userA/blabla/14'
    const result = pathParser.parse(path)
    expect(result.regexp.test(name)).to.equal(true)

    const r = name.match(result.regexp) || []
    expect(r.join(',')).to.deep.equal('private/userA/blabla/14,userA,14')

    const reject = name.match(result.regexp) || false
    expect(reject[1]).to.equal('userA')
  })
})
