/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const messageHandler = require('../../../src/cluster/messaging/message-handler.js')
const C = require('../../../src/constants/constants')

fdescribe('cluster binary message handler', () => {
  describe('getBinaryMsg()', () => {
    it('serializes a message without a payload', () => {
      expect(messageHandler.getBinaryMsg(0xab, 0xcd)).toEqual(
        Buffer.of(0xab, 0xcd, 0x00, 0x00, 0x00, 0x00)
      )
    })

    it('serializes a message with an object payload', () => {
      const result = messageHandler.getBinaryMsg(0xcd, 0xef, { foo: ['bar'] })
      const header = Buffer.of(0xcd, 0xef, 0x00, 0x00, 0x00, 0x0f)
      const payload = Buffer.from('{"foo":["bar"]}')
      expect(result).toEqual(Buffer.concat([header, payload]))
    })

    it('serializes a message with an array payload', () => {
      const result = messageHandler.getBinaryMsg(0x01, 0x23, ['one', 2, '3'])
      const header = Buffer.of(0x01, 0x23, 0x00, 0x00, 0x00, 0x0d)
      const payload = Buffer.from('["one",2,"3"]')
      expect(result).toEqual(Buffer.concat([header, payload]))
    })

    it('serializes a message with a 16 MB - 1 payload', () => {
      const length = 0xffffff
      const payload = Buffer.alloc(length)
      const result = messageHandler.getBinaryMsg(0x01, 0x23, payload)

      const header = Buffer.of(0x01, 0x23, 0x00, 0xff, 0xff, 0xff)
      expect(result.slice(0, 6)).toEqual(header)
      expect(result.length).toEqual(0x1000005)
    })

    it('refuses to serialize a 16 MB payload', () => {
      const length = 0x1000000
      const payload = Buffer.alloc(length)
      expect(() => messageHandler.getBinaryMsg(0x01, 0x23, payload)).toThrowError(/too long/)
    })
  })
  /*
   *describe('tryParseBinaryMsg()', () => {
   *  it('')
   *})
   */
})
