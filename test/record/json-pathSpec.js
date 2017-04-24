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

  it('sets values for nested objects with numeric field names', () => {
    let record = {},
      jsonPath = new JsonPath('address.street.1')
    jsonPath.setValue(record, 'someStreet')

    expect(record).toEqual({
      address: {
          street: {
              1: 'someStreet'
          }
      }
    })
  })


  it('sets values for nested objects with multiple numeric field names', () => {
    let record = {},
      jsonPath = new JsonPath('address.99.street.1')
    jsonPath.setValue(record, 'someStreet')

    expect(record).toEqual({
      address: {
        99 : {
          street: {
            1: 'someStreet'
          }
        }
      }
    })
  })


  it('sets values for nested objects with multiple mixed array and numeric field names', () => {
    let record = {},
      jsonPath = new JsonPath('address[2].99.street[2].1')
    jsonPath.setValue(record, 'someStreet')

    expect(record).toEqual({
      address: [
          undefined,
          undefined,
          {
              99 : {
                  street: [
                      undefined,
                      undefined,
                      {
                          1: 'someStreet'
                      }
                  ]
              }
          }
        ]
    })
  })

  it('sets first value of array', () => {
    let record = {},
      jsonPath = new JsonPath('items[0]')
    jsonPath.setValue(record, 51)

    expect(JSON.stringify(record)).toEqual(JSON.stringify({
        items: [
            51
        ]
    }))
  })

  it('sets numeric obj member name of 0 (zero)', () => {
    let record = {},
      jsonPath = new JsonPath('items.0')
    jsonPath.setValue(record, 51)

    expect(JSON.stringify(record)).toEqual(JSON.stringify({
      items: {
        0 : 51
      }
    }))
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
        }
      ]
    }))
  })

  it('sets value AS arrays of arrays', () => {
    let record = {
        addresses: undefined
      },
      arrOfArr = [
        undefined,
        [
          'new-Street1', 'road1', 'blvd1'
        ],
        [
          'street2', 'road2', 'blvd2'
        ]
      ]
      ,
      jsonPath = new JsonPath('addresses')

    jsonPath.setValue(record, arrOfArr)

    expect(JSON.stringify(record)).toEqual(JSON.stringify({
      addresses: [
        undefined,
        [
          'new-Street1', 'road1', 'blvd1'
        ],
        [
          'street2', 'road2', 'blvd2'
        ]
      ]
    }))
  })

  it('sets value IN arrays of arrays', () => {
    let record = {
        addresses: [
          undefined,
          [
            'street1', 'road1', 'blvd1'
          ],
          [
            'street2', 'road2', 'blvd2'
          ]
        ]
      },
      jsonPath = new JsonPath('addresses[1][0]')

    jsonPath.setValue(record, 'new-Street1')

    expect(JSON.stringify(record)).toEqual(JSON.stringify({
      addresses: [
        undefined,
        [
          'new-Street1', 'road1', 'blvd1'
        ],
        [
          'street2', 'road2', 'blvd2'
        ]
      ]
    }))
  })

  it('sets value IN deeper nested multi-dimensional arrays of arrays', () => {
    let record = {
        obj: {
          101 : {
            addresses: [
              [
                undefined,
                [
                  undefined,
                  [ 'street1', 'road1', 'blvd1' ],
                  [ 'street2', 'road2', 'blvd2' ]
                ],
                [
                  undefined,
                  { a: 'street1', b: 'road1', c: 'blvd1' },
                  { 1: 'street2', 2: 'road2', 3: 'blvd2' }
                ]
              ],
              undefined,
              [ [0,1,2,3], [9,8,7,6], [2,4,6,8] ]
            ]
          }
        }
      },
      jsonPath = new JsonPath('obj.101.addresses[0][1][1][0]')

    jsonPath.setValue(record, 'new-Street1')

    expect(JSON.stringify(record)).toEqual(JSON.stringify({
        obj: {
          101 : {
            addresses: [
              [
                undefined,
                [
                  undefined,
                  [ 'new-Street1', 'road1', 'blvd1' ],
                  [ 'street2', 'road2', 'blvd2' ]
                ],
                [
                  undefined,
                  { a: 'street1', b: 'road1', c: 'blvd1' },
                  { 1: 'street2', 2: 'road2', 3: 'blvd2' }
                ]
              ],
              undefined,
              [ [0,1,2,3], [9,8,7,6], [2,4,6,8] ]
            ]
          }
        }
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

  it('extends existing arrays with empty slot assigned a primitive', () => {
    let record = {
      firstname: 'Wolfram',
      animals: [undefined, 'Cow', 'Ostrich']
    },
      jsonPath = new JsonPath('animals[0]')
    jsonPath.setValue(record, 'Emu')

    expect(record).toEqual({
      firstname: 'Wolfram',
      animals: ['Emu', 'Cow', 'Ostrich']
    })
  })

  it('extends existing arrays with objects', () => {
    let record = {
        firstname: 'Wolfram',
        animals: [undefined, 'Cow', 'Ostrich']
    },
      jsonPath = new JsonPath('animals[0].xxx')
    jsonPath.setValue(record, 'Emu')

    expect(record).toEqual({
      firstname: 'Wolfram',
      animals: [{ xxx: 'Emu'}, 'Cow', 'Ostrich']
    })
  })

})
