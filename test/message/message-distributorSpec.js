/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach, beforeAll */
'use strict'

const MessageDistributor = require('../../dist/src/message/message-distributor')
const testHelper = require('../test-helper/test-helper')
const getTestMocks = require('../test-helper/test-mocks')

const options = testHelper.getDeepstreamOptions()

describe('message connector distributes messages to callbacks', () => {
  let messageDistributor
  let testMocks
  let client
  let testCallback

  beforeEach(() => {
    testMocks = getTestMocks()
    client = testMocks.getSocketWrapper()
    testCallback = jasmine.createSpy()

    messageDistributor = new MessageDistributor(options)
  })

  afterEach(() => {
    client.socketWrapperMock.verify()
  })

  it('makes remote connection', () => {
    expect(options.message.lastSubscribedTopic).toBe(null)

    messageDistributor.registerForTopic('someTopic', testCallback)

    expect(options.message.lastSubscribedTopic).toBe('someTopic')
  })

  it('makes local connection', () => {
    messageDistributor.registerForTopic('someTopic', testCallback)

    messageDistributor.distribute(client.socketWrapper, { topic: 'someTopic' })

    expect(testCallback.calls.count()).toEqual(1)
  })

  it('routes messages from the message connector', () => {
    messageDistributor.registerForTopic('topicB', testCallback)

    options.message.simulateIncomingMessage('topicB', { topic: 'topicB' })

    expect(testCallback.calls.count()).toEqual(1)
  })

  it('only routes matching topics', () => {
    messageDistributor.registerForTopic('aTopic', testCallback)
    messageDistributor.registerForTopic('anotherTopic', testCallback)

    messageDistributor.distribute(client.socketWrapper, { topic: 'aTopic' })

    expect(testCallback.calls.count()).toEqual(1)
  })

  it('throws an error for multiple registrations to the same topic', () => {
    let hasErrored = false

    try {
      messageDistributor.registerForTopic('someTopic', testCallback)
      messageDistributor.registerForTopic('someTopic', testCallback)
    } catch (e) {
      hasErrored = true
    }

    expect(hasErrored).toBe(true)
  })
})
