/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const messageParser = require('../../src/message/message-parser')

describe('message parser processes raw messages correctly', () => {
  let x = String.fromCharCode(30), // ASCII Record Seperator 1E
    y = String.fromCharCode(31) // ASCII Unit Separator 1F

  function parse(str) {
    const messages = []
    messageParser.parse(str, message => messages.push(message))
    return messages.length ? messages : null
  }

  it('parses record messages correctly', () => {
    expect(parse(`record${y}C${y}user/someId`)).toEqual([{
      topic: 'record',
      raw: `record${y}C${y}user/someId`,
      action: 'C',
      data: ['user/someId']
    }])

    expect(parse(`record${y}C${y}user/someId${y}{"firstname":"Wolfram"}`)).toEqual([{
      topic: 'record',
      raw: `record${y}C${y}user/someId${y}{"firstname":"Wolfram"}`,
      action: 'C',
      data: ['user/someId', '{"firstname":"Wolfram"}']
    }])

    expect(parse(`record${y}R${y}user/someId`)).toEqual([{
      topic: 'record',
      raw: `record${y}R${y}user/someId`,
      action: 'R',
      data: ['user/someId']
    }])

    expect(parse(`record${y}U${y}user/someId${y}{"firstname":"Wolfram"}`)).toEqual([{
      topic: 'record',
      raw: `record${y}U${y}user/someId${y}{"firstname":"Wolfram"}`,
      action: 'U',
      data: ['user/someId', '{"firstname":"Wolfram"}']
    }])

    expect(parse(`record${y}D${y}user/someId`)).toEqual([{
      topic: 'record',
      raw: `record${y}D${y}user/someId`,
      action: 'D',
      data: ['user/someId']
    }])

    expect(parse(`record${y}US${y}user/someId`)).toEqual([{
      topic: 'record',
      raw: `record${y}US${y}user/someId`,
      action: 'US',
      data: ['user/someId']
    }])
  })

  it('parses subscription messages correctly', () => {
    expect(parse(`listen${y}S${y}user/someId`)).toEqual([{
      topic: 'listen',
      raw: `listen${y}S${y}user/someId`,
      action: 'S',
      data: ['user/someId']
    }])

    expect(parse(`listen${y}US${y}user/someId`)).toEqual([{
      topic: 'listen',
      raw: `listen${y}US${y}user/someId`,
      action: 'US',
      data: ['user/someId']
    }])
  })

  it('parses rpc messages correctly', () => {
    expect(parse(`RPC${y}REQ${y}addValues${y}{"val1":1,"val2":2}`)).toEqual([{
      topic: 'RPC',
      raw: `RPC${y}REQ${y}addValues${y}{"val1":1,"val2":2}`,
      action: 'REQ',
      data: ['addValues', '{"val1":1,"val2":2}']
    }])

    expect(parse(`RPC${y}S${y}addValues`)).toEqual([{
      topic: 'RPC',
      raw: `RPC${y}S${y}addValues`,
      action: 'S',
      data: ['addValues']
    }])

    expect(parse(`RPC${y}US${y}addValues`)).toEqual([{
      topic: 'RPC',
      raw: `RPC${y}US${y}addValues`,
      action: 'US',
      data: ['addValues']
    }])
  })

  it('parses event messages correctly', () => {
    expect(parse(`event${y}S${y}someEvent`)).toEqual([{
      topic: 'event',
      raw: `event${y}S${y}someEvent`,
      action: 'S',
      data: ['someEvent']
    }])

    expect(parse(`event${y}US${y}someEvent`)).toEqual([{
      topic: 'event',
      raw: `event${y}US${y}someEvent`,
      action: 'US',
      data: ['someEvent']
    }])
  })

  it('parses message blocks correctly', () => {
    const blockMsg = `record${y}C${y}user/someId${y}{"firstname":"Wolfram"}${x}RPC${y}S${y}addValues${x}event${y}S${y}someEvent`

    expect(parse(blockMsg)).toEqual([{
      topic: 'record',
      raw: `record${y}C${y}user/someId${y}{"firstname":"Wolfram"}`,
      action: 'C',
      data: ['user/someId', '{"firstname":"Wolfram"}']
    }, {
      topic: 'RPC',
      raw: `RPC${y}S${y}addValues`,
      action: 'S',
      data: ['addValues']
    }, {
      topic: 'event',
      raw: `event${y}S${y}someEvent`,
      action: 'S',
      data: ['someEvent']
    }])
  })

  it('handles broken messages gracefully', () => {
    expect(parse('dfds')).toEqual([null])
    expect(parse(`record${y}unkn`)).toEqual([null])
    expect(parse(`record${y}unkn${y}aaa`)).toEqual([null])
  })
})
