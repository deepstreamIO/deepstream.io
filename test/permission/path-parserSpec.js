/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const pathParser = require('../../src/permission/path-parser')

const isRegExp = function (val) {
  return typeof val === 'object' && typeof val.test === 'function'
}

describe('validates paths in permission.json files', () => {
  it('exposes a validate method', () => {
    expect(typeof pathParser.validate).toBe('function')
  })

  it('accepts a valid path', () => {
    expect(pathParser.validate('game-comment/$gameId/*')).toBe(true)
  })

  it('rejects none strings', () => {
    expect(pathParser.validate(3)).toBe('path must be a string')
  })

  it('rejects empty strings', () => {
    expect(pathParser.validate('')).toBe('path can\'t be empty')
  })

  it('rejects paths starting with /', () => {
    expect(pathParser.validate('/bla')).toBe('path can\'t start with /')
  })

  it('rejects paths with invalid variable names', () => {
    expect(pathParser.validate('bla/$-')).toBe('invalid variable name $-')
    expect(pathParser.validate('bla/$$aa')).toBe('invalid variable name $$')
  })
})


describe('parses valid paths in permission.json files', () => {
  it('exposes a parse method', () => {
    expect(typeof pathParser.parse).toBe('function')
  })

  it('parses a simple, valid path', () => {
    const result = pathParser.parse('i-am-valid')
    expect(isRegExp(result.regexp)).toBe(true)
    expect(result.regexp.toString()).toBe('/^i-am-valid$/')
    expect(result.variables.length).toBe(0)
  })

  it('parses a valid path with a wildcard', () => {
    const result = pathParser.parse('i-am-valid/*')
    expect(isRegExp(result.regexp)).toBe(true)
    expect(result.regexp.toString()).toBe('/^i-am-valid\\/.*$/')
    expect(result.variables.length).toBe(0)
  })

  it('parses a valid path with a variable', () => {
    const result = pathParser.parse('game-score/$gameId')
    expect(isRegExp(result.regexp)).toBe(true)
    expect(result.regexp.toString()).toBe('/^game-score\\/([^\\/]+)$/')
    expect(result.variables).toEqual(['$gameId'])
  })

  it('parses a valid path with multiple variables', () => {
    const result = pathParser.parse('game-comment/$gameId/$userId/$commentId')
    expect(isRegExp(result.regexp)).toBe(true)
    expect(result.regexp.toString()).toBe('/^game-comment\\/([^\\/]+)\\/([^\\/]+)\\/([^\\/]+)$/')
    expect(result.variables).toEqual(['$gameId', '$userId', '$commentId'])
  })

  it('parses a path with a mix of variables and wildcards', () => {
    const result = pathParser.parse('$recordName/*')
    expect(isRegExp(result.regexp)).toBe(true)
    expect(result.regexp.toString()).toBe('/^([^\\/]+)\\/.*$/')
    expect(result.variables).toEqual(['$recordName'])
  })
})

describe('applies regexp to paths', () => {
  it('applies a regexp to a simple path', () => {
    const path = 'public/*'
    const result = pathParser.parse(path)
    expect(result.regexp.test('public/details/info')).toBe(true)
    expect(result.regexp.test('private/details/info')).toBe(false)
  })

  it('applies a regexp and extracts a variable from a simple path', () => {
    const path = 'private/$userId'
    const name = 'private/userA'
    const result = pathParser.parse(path)
    expect(result.regexp.test(name)).toBe(true)
    expect(name.match(result.regexp)[1]).toBe('userA')
  })

  it('applies a regexp and extracts variables from a more complex path', () => {
    const path = 'private/$userId/*/$anotherId'
    const name = 'private/userA/blabla/14'
    const result = pathParser.parse(path)
    expect(result.regexp.test(name)).toBe(true)
    expect(name.match(result.regexp).join(',')).toEqual('private/userA/blabla/14,userA,14')
  })
})
