import 'mocha'
import {spy} from 'sinon'
import {expect} from 'chai'
import { EventEmitter } from 'events'
import { createHash } from './utils';
const utils = require('./utils')

describe('utils', () => {
  it('receives a different value everytime getUid is called', () => {
    const uidA = utils.getUid()
    const uidB = utils.getUid()
    const uidC = utils.getUid()

    expect(uidA).not.to.equal(uidB)
    expect(uidB).not.to.equal(uidC)
    expect(uidA).not.to.equal(uidC)
  })

  it('reverses maps', () => {
    const user = {
      firstname: 'Wolfram',
      lastname: 'Hempel'
    }

    expect(utils.reverseMap(user)).to.deep.equal({
      Wolfram: 'firstname',
      Hempel: 'lastname'
    })
  })

  describe('isOfType', () => {
    it('checks basic types', () => {
      expect(utils.isOfType('bla', 'string')).to.equal(true)
      expect(utils.isOfType(42, 'string')).to.equal(false)
      expect(utils.isOfType(42, 'number')).to.equal(true)
      expect(utils.isOfType(true, 'number')).to.equal(false)
      expect(utils.isOfType(true, 'boolean')).to.equal(true)
      expect(utils.isOfType({}, 'object')).to.equal(true)
      expect(utils.isOfType(null, 'null')).to.equal(true)
      expect(utils.isOfType(null, 'object')).to.equal(false)
      expect(utils.isOfType([], 'object')).to.equal(true)
    })

    it('checks urls', () => {
      expect(utils.isOfType('bla', 'url')).to.equal(false)
      expect(utils.isOfType('bla:22', 'url')).to.equal(true)
      expect(utils.isOfType('https://deepstream.io/', 'url')).to.equal(true)
    })

    it('checks arrays', () => {
      expect(utils.isOfType([], 'array')).to.equal(true)
      expect(utils.isOfType({}, 'array')).to.equal(false)
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
      expect(utils.validateMap(map, false, schema)).to.equal(true)
    })

    it('fails validating an incorrect map', () => {
      const map = _map()
      const schema = _schema()
      schema['an array'] = 'number'
      const returnValue = utils.validateMap(map, false, schema)
      expect(returnValue instanceof Error).to.equal(true)
    })

    it('fails validating an incomplete map', () => {
      const map = _map()
      const schema = _schema()
      delete map['an array']
      const returnValue = utils.validateMap(map, false, schema)
      expect(returnValue instanceof Error).to.equal(true)
    })

    it('throws errors', () => {
      const map = _map()
      const schema = _schema()
      schema['an array'] = 'number'
      expect(() => {
        utils.validateMap(map, true, schema)
      }).to.throw()
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

      expect(utils.merge(objA, objB)).to.deep.equal({
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

      expect(utils.merge(objA, objB)).to.deep.equal({
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

      expect(utils.merge(objA, objB, {}, objC)).to.deep.equal({
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

      expect(utils.merge(objA, objB)).to.deep.equal({
        pets: {
          dog: 1,
          cat: null,
          ape: 3,
          zebra: 9
        }
      })
    })
  })

  it('creates a hash', async() => {
    const password = 'userAPass'
    const settings = {
      algorithm: 'md5',
      iterations: 100,
      keyLength: 32
    }
    const { hash, salt } = await createHash(password, settings)
    const { hash: hashCheck } = await createHash(password, settings, salt)
    expect(hash.toString('base64')).to.eq(hashCheck.toString('base64'))
  })
})
