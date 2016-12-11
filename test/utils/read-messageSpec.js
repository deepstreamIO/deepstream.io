/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const Deepstream = require('../../src/deepstream.io')

describe('parses low level authData to simpler output', () => {
  let message
  let parsedMessage

  beforeEach(() => {
    message = {
      topic: 'R',
      action: 'CR',
      data: ['RecordName', 1, 'data']
    }

    parsedMessage = {
      isRecord: false,
      isEvent: false,
      isRPC: false,

      isCreate: false,
      isRead: false,
      isChange: false,
      isDelete: false,

      isAck: false,
      isSubscribe: false,
      isUnsubscribe: false,
      isRequest: false,
      isRejection: false,

      name: 'RecordName',
      path: undefined,
      data: 'data'
    }
  })

  it('parses RPC message correctly', () => {
    message.topic = 'P'
    message.action = ''

    parsedMessage.isRPC = true

    expect(Deepstream.readMessage(message)).toEqual(parsedMessage)
  })

  it('parses Event message correctly', () => {
    message.topic = 'E'
    message.action = ''

    parsedMessage.isEvent = true

    expect(Deepstream.readMessage(message)).toEqual(parsedMessage)
  })

  describe('when a record is recieved', () => {
    beforeEach(() => {
      parsedMessage.isRecord = true
    })

    it('parses read/create message correctly', () => {
      message.action = 'CR'
      message.data = ['RecordName', 1, 'data']

      parsedMessage.isCreate = true
      parsedMessage.isRead = true

      expect(Deepstream.readMessage(message)).toEqual(parsedMessage)
    })

    it('parses patch message correctly', () => {
      message.action = 'P'
      message.data = ['RecordName', 1, 'path', 'data']

      parsedMessage.isChange = true
      parsedMessage.path = 'path'
      parsedMessage.data = 'data'

      expect(Deepstream.readMessage(message)).toEqual(parsedMessage)
    })

    it('returns record gets changed via update', () => {
      message.action = 'U'
      message.data = ['RecordName', 1, 'data']

      parsedMessage.isChange = true
      parsedMessage.data = 'data'

      expect(Deepstream.readMessage(message)).toEqual(parsedMessage)
    })

    it('returns record gets deleted', () => {
      message.action = 'D'
      parsedMessage.isDelete = true

      expect(Deepstream.readMessage(message)).toEqual(parsedMessage)
    })
  })
})
