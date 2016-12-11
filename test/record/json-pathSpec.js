/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const JsonPath = require('../../src/record/json-path')

describe('objects are created from paths and their value is set correctly', () => {
  it('sets simple values', () => {
    let record = {},
      jsonPath = new JsonPath('firstname')

    jsonPath.setValue(record, 'Wolfram')
    expect(record).toEqual({ firstname: 'Wolfram' })
  })

  it('sets values for nested objects', () => {
    let record = {},
      jsonPath = new JsonPath('address.street')
    jsonPath.setValue(record, 'someStreet')

    expect(record).toEqual({
      address: {
        street: 'someStreet'
      }
    })
  })

  it('sets values for arrays', () => {
    let record = {},
      jsonPath = new JsonPath('pastAddresses[1].street')
    jsonPath.setValue(record, 'someStreet')

    expect(JSON.stringify(record)).toEqual(JSON.stringify({
      pastAddresses: [
        undefined,
        {
          street: 'someStreet'
        }]
    }))
  })

  it('extends existing objects', () => {
    let record = { firstname: 'Wolfram' },
      jsonPath = new JsonPath('lastname')
    jsonPath.setValue(record, 'Hempel')

    expect(record).toEqual({
      firstname: 'Wolfram',
      lastname: 'Hempel'
    })
  })

  it('extends existing arrays', () => {
    let record = {
        firstname: 'Wolfram',
        animals: ['Bear', 'Cow', 'Ostrich']
      },
      jsonPath = new JsonPath('animals[ 1 ]')
    jsonPath.setValue(record, 'Emu')

    expect(record).toEqual({
      firstname: 'Wolfram',
      animals: ['Bear', 'Emu', 'Ostrich']
    })
  })
})
