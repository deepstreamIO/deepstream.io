/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const utils = require('../../src/utils/utils')
const EventEmitter = require('events').EventEmitter

describe('utils', () => {
  it('receives a different value everytime getUid is called', () => {
    const uidA = utils.getUid()
    const uidB = utils.getUid()
    const uidC = utils.getUid()

    expect(uidA).not.toBe(uidB)
    expect(uidB).not.toBe(uidC)
    expect(uidA).not.toBe(uidC)
  })

  it('combines multiple events into one', () => {
    const emitters = [
      new EventEmitter(),
      new EventEmitter(),
      new EventEmitter()
    ]
    const callback = jasmine.createSpy('eventCallback')

    utils.combineEvents(emitters, 'someEvent', callback)
    expect(callback).not.toHaveBeenCalled()

    emitters[0].emit('someEvent')
    expect(callback).not.toHaveBeenCalled()

    emitters[1].emit('someEvent')
    emitters[2].emit('someEvent')
    expect(callback).toHaveBeenCalled()
  })

  it('reverses maps', () => {
    const user = {
      firstname: 'Wolfram',
      lastname: 'Hempel'
    }

    expect(utils.reverseMap(user)).toEqual({
      Wolfram: 'firstname',
      Hempel: 'lastname'
    })
  })

  describe('deepCopy', () => {
    it('copies primitives', () => {
      expect(utils.deepCopy('bla')).toBe('bla')
      expect(utils.deepCopy(42)).toBe(42)
    })

    it('copies arrays', () => {
      const original = ['a', 'b', 2]
      const copy = utils.deepCopy(original)

      expect(copy).toEqual(original)
      expect(copy).not.toBe(original)
    })

    it('copies objects', () => {
      const original = { firstname: 'Wolfram', lastname: ' Hempel' }
      const copy = utils.deepCopy(original)

      expect(copy).toEqual(original)
      expect(copy).not.toBe(original)
    })

    it('copies objects with null values', () => {
      const original = { firstname: 'Wolfram', lastname: null }
      const copy = utils.deepCopy(original)

      expect(copy).toEqual(original)
      expect(copy).not.toBe(original)
    })

    it('copies null values', () => {
      const copy = utils.deepCopy(null)
      expect(copy).toBeNull()
    })

    it('copies nested values', () => {
      const original = { a: { b: 'c', d: 4 } }
      const copy = utils.deepCopy(original)
      expect(original).toEqual(copy)
      expect(original.a).not.toBe(copy.a)
    })

    it('copies nested arrays', () => {
      const original = { a: { b: 'c', d: ['a', { x: 'y' }] } }
      const copy = utils.deepCopy(original)
      expect(original).toEqual(copy)
      expect(original.a.d).not.toBe(copy.a.d)
      expect(Array.isArray(copy.a.d)).toBe(true)
      expect(copy.a.d[1]).toEqual({ x: 'y' })
      expect(original.a.d[1] === copy.a.d[1]).toBe(false)
    })

  // This is a JSON.stringify specific behaviour. Not too sure it's ideal,
  // but it is something that will break behaviour when changed, so let's
  // keep an eye on it
    it('converts undefined', () => {
      let copy = utils.deepCopy([undefined])
      expect(copy[0]).toBe(null)

      copy = utils.deepCopy({ x: undefined })
      expect(copy).toEqual({})
    })
  })

  describe('isOfType', () => {
    it('checks basic types', () => {
      expect(utils.isOfType('bla', 'string')).toBe(true)
      expect(utils.isOfType(42, 'string')).toBe(false)
      expect(utils.isOfType(42, 'number')).toBe(true)
      expect(utils.isOfType(true, 'number')).toBe(false)
      expect(utils.isOfType(true, 'boolean')).toBe(true)
      expect(utils.isOfType({}, 'object')).toBe(true)
      expect(utils.isOfType(null, 'null')).toBe(true)
      expect(utils.isOfType(null, 'object')).toBe(false)
      expect(utils.isOfType([], 'object')).toBe(true)
    })

    it('checks urls', () => {
      expect(utils.isOfType('bla', 'url')).toBe(false)
      expect(utils.isOfType('bla:22', 'url')).toBe(true)
      expect(utils.isOfType('https://deepstream.io/', 'url')).toBe(true)
    })

    it('checks arrays', () => {
      expect(utils.isOfType([], 'array')).toBe(true)
      expect(utils.isOfType({}, 'array')).toBe(false)
    })
  })

  describe('validateMap', () => {
    function _map () {
      return {
        'a-string': 'bla',
        'a number': 42,
        'an array': ['yup']
      }
    }

    function _schema () {
      return {
        'a-string': 'string',
        'a number': 'number',
        'an array': 'array'
      }
    }

    it('validates basic maps', () => {
      const map = _map()
      const schema = _schema()
      expect(utils.validateMap(map, false, schema)).toBe(true)
    })

    it('fails validating an incorrect map', () => {
      const map = _map()
      const schema = _schema()
      schema['an array'] = 'number'
      const returnValue = utils.validateMap(map, false, schema)
      expect(returnValue instanceof Error).toBe(true)
    })

    it('fails validating an incomplete map', () => {
      const map = _map()
      const schema = _schema()
      delete map['an array']
      const returnValue = utils.validateMap(map, false, schema)
      expect(returnValue instanceof Error).toBe(true)
    })

    it('throws errors', () => {
      const map = _map()
      const schema = _schema()
      schema['an array'] = 'number'
      expect(() => {
        utils.validateMap(map, true, schema)
      }).toThrow()
    })
  })

  describe('merges recoursively', () => {
    it('merges two simple objects', () => {
      const objA = {
        firstname: 'Homer',
        lastname: 'Simpson'
      }

      const objB = {
        firstname: 'Marge'
      }

      expect(utils.merge(objA, objB)).toEqual({
        firstname: 'Marge',
        lastname: 'Simpson'
      })
    })

    it('merges two nested objects', () => {
      const objA = {
        firstname: 'Homer',
        lastname: 'Simpson',
        children: {
          Bart: {
            lastname: 'Simpson'
          }
        }
      }

      const objB = {
        firstname: 'Marge',
        children: {
          Bart: {
            firstname: 'Bart'
          }
        }
      }

      expect(utils.merge(objA, objB)).toEqual({
        firstname: 'Marge',
        lastname: 'Simpson',
        children: {
          Bart: {
            firstname: 'Bart',
            lastname: 'Simpson'
          }
        }
      })
    })

    it('merges multiple objects ', () => {
      const objA = {
        pets: {
          birds: ['parrot', 'dove']
        }

      }

      const objB = {
        jobs: {
          hunter: false
        }
      }

      const objC = {
        firstname: 'Egon'
      }

      expect(utils.merge(objA, objB, {}, objC)).toEqual({
        pets: {
          birds: ['parrot', 'dove']
        },
        jobs: {
          hunter: false
        },
        firstname: 'Egon'
      })
    })

    it('handles null and undefined values', () => {
      const objA = {
        pets: {
          dog: 1,
          cat: 2,
          ape: 3
        }

      }

      const objB = {
        pets: {
          cat: null,
          ape: undefined,
          zebra: 9
        }
      }

      expect(utils.merge(objA, objB)).toEqual({
        pets: {
          dog: 1,
          cat: null,
          ape: 3,
          zebra: 9
        }
      })
    })
  })

  describe('json parse', () => {
    it('parses valid json and returns value', () => {
      const result = utils.parseJSON('{"a":2}')
      expect(result.error).toBeUndefined()
      expect(result.value).toEqual({ a: 2 })
    })

    it('parses invalid json and returns error', () => {
      const result = utils.parseJSON('{"a:2}')
      expect(result.value).toBeUndefined()
      expect(result.error).not.toBeNull()
    })
  })
})
