/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const messageHandler = require('../../../src/cluster/messaging/message-handler')

describe('cluster binary message handler', () => {
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
  describe('tryParseBinaryMsg()', () => {
    it('deserializes a message without a payload', () => {
      const buff = Buffer.of(0x01, 0x02, 0x00, 0x00, 0x00, 0x00)
      const onBodyParseErrorSpy = jasmine.createSpy('onBodyParseError')
      const result = messageHandler.tryParseBinaryMsg(buff, onBodyParseErrorSpy)
      expect(result.message).toEqual({
        topicByte: 0x01,
        actionByte: 0x02,
        optionByte: 0x00,
        payloadLength: 0
      })
      expect(result.bytesConsumed).toEqual(6)
      expect(onBodyParseErrorSpy).not.toHaveBeenCalled()
    })

    it('deserializes a message with a payload', () => {
      const buff = Buffer.of(0xab, 0xcd, 0x00, 0x00, 0x00, 0x0d,
        0x7b, 0x22, 0x66, 0x6f, 0x6f, 0x22, 0x3a, 0x22, 0x62, 0x61, 0x72, 0x22, 0x7d)
      const onBodyParseErrorSpy = jasmine.createSpy('onBodyParseError')
      const result = messageHandler.tryParseBinaryMsg(buff, onBodyParseErrorSpy)
      expect(result.message).toEqual({
        topicByte: 0xab,
        actionByte: 0xcd,
        optionByte: 0x00,
        payloadLength: 13,
        body: { foo: 'bar' }
      })
      expect(result.bytesConsumed).toEqual(6 + 13)
      expect(onBodyParseErrorSpy).not.toHaveBeenCalled()
    })

    it('does not consume an incomplete header', () => {
      const buff = Buffer.of(0x01, 0x02, 0x00, 0x00, 0x00)
      const onBodyParseErrorSpy = jasmine.createSpy('onBodyParseError')
      const result = messageHandler.tryParseBinaryMsg(buff, onBodyParseErrorSpy)
      expect(result.message).toEqual(undefined)
      expect(result.bytesConsumed).toEqual(0)
      expect(onBodyParseErrorSpy).not.toHaveBeenCalled()
    })

    it('does not consume an incomplete payload', () => {
      const buff = Buffer.of(0x01, 0x02, 0x00, 0x00, 0x00, 0x02,
        0x00)
      const onBodyParseErrorSpy = jasmine.createSpy('onBodyParseError')
      const result = messageHandler.tryParseBinaryMsg(buff, onBodyParseErrorSpy)
      expect(result.message).toEqual(undefined)
      expect(result.bytesConsumed).toEqual(0)
      expect(onBodyParseErrorSpy).not.toHaveBeenCalled()
    })

    it('calls the callback when the payload is invalid JSON', () => {
      const buff = Buffer.concat([
        Buffer.of(0x01, 0x02, 0x00, 0x00, 0x00, 0x01),
        Buffer.from('{')
      ])
      const onBodyParseErrorSpy = jasmine.createSpy('onBodyParseError')
      const result = messageHandler.tryParseBinaryMsg(buff, onBodyParseErrorSpy)
      expect(result.message).toEqual(undefined)
      expect(result.bytesConsumed).toEqual(6 + 1)
      expect(onBodyParseErrorSpy).toHaveBeenCalled()
    })
  })
})
