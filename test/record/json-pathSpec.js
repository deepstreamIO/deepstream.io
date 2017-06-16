/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const jsonPath = require('../../src/record/json-path')

describe('objects are created from paths and their value is set correctly', () => {
  it('sets simple values', () => {
    let record = {}

    jsonPath.setValue(record, 'firstname', 'Wolfram')
    expect(record).toEqual({ firstname: 'Wolfram' })
  })

  it('sets values for nested objects', () => {
    let record = {}

    jsonPath.setValue(record, 'address.street', 'someStreet')

    expect(record).toEqual({
      address: {
        street: 'someStreet'
      }
    })
  })

  it('sets values for arrays', () => {
    let record = {}

    jsonPath.setValue(record, 'pastAddresses[1].street', 'someStreet')

    expect(JSON.stringify(record)).toEqual(JSON.stringify({
      pastAddresses: [
        undefined,
        {
          street: 'someStreet'
        }]
    }))
  })

  it('extends existing objects', () => {
    let record = { firstname: 'Wolfram' }

    jsonPath.setValue(record, 'lastname', 'Hempel')

    expect(record).toEqual({
      firstname: 'Wolfram',
      lastname: 'Hempel'
    })
  })

  it('extends existing arrays', () => {
    let record = {
        firstname: 'Wolfram',
        animals: ['Bear', 'Cow', 'Ostrich']
      }

    jsonPath.setValue(record, 'animals[ 1 ]', 'Emu')

    expect(record).toEqual({
      firstname: 'Wolfram',
      animals: ['Bear', 'Emu', 'Ostrich']
    })
  })
})
