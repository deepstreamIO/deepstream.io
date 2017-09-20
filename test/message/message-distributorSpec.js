/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach, beforeAll */
'use strict'

const SocketMock = require('../mocks/socket-mock')
const SocketWrapper = require('../mocks/socket-wrapper-mock')
const MessageDistributor = require('../../src/message/message-distributor')
const testHelper = require('../test-helper/test-helper')

const options = testHelper.getDeepstreamOptions()
const _msg = testHelper.msg

describe('message connector distributes messages to callbacks', () => {
  let messageDistributor
  const testCallback = jasmine.createSpy('testCallback')

  beforeAll(() => {
    messageDistributor = new MessageDistributor(options)
  })

  it('routes topics to subscribers', () => {
    expect(testCallback).not.toHaveBeenCalled()
    expect(options.message.lastSubscribedTopic).toBe(null)
    messageDistributor.registerForTopic('someTopic', testCallback)
    expect(options.message.lastSubscribedTopic).toBe('someTopic')
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    messageDistributor.distribute(socketWrapper, { topic: 'someTopic' })
    expect(testCallback.calls.count()).toEqual(1)
  })

  it('routes messages from the message connector', () => {
    const cb = jasmine.createSpy('callback')
    messageDistributor.registerForTopic('topicB', cb)
    expect(options.message.lastSubscribedTopic).toBe('topicB')
    expect(cb).not.toHaveBeenCalled()
    options.message.simulateIncomingMessage('topicB', { topic: 'topicB' })
    expect(cb).toHaveBeenCalled()
  })

  it('only routes matching topics', () => {
    expect(testCallback.calls.count()).toEqual(1)

    const socketWrapper = new SocketWrapper(new SocketMock(), {})

    messageDistributor.distribute(socketWrapper, { topic: 'someOtherTopic' })
    expect(testCallback.calls.count()).toEqual(1)
  })

  it('throws an error for multiple registrations to the same topic', () => {
    let hasErrored = false

    try {
      messageDistributor.registerForTopic('someTopic', testCallback)
    } catch (e) {
      hasErrored = true
    }

    expect(hasErrored).toBe(true)
  })

  it('sends errors for messages to unknown topics', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), {})
    expect(socketWrapper.socket.lastSendMessage).toBe(null)
    messageDistributor.distribute(socketWrapper, { topic: 'gibberish' })
    expect(socketWrapper.socket.lastSendMessage).toBe(_msg('X|E|UNKNOWN_TOPIC|gibberish+'))
  })
})
