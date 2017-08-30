/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const SocketWrapper = require('../mocks/socket-wrapper-mock')
const C = require('../../src/constants/constants')
const SocketMock = require('../mocks/socket-mock')
const testHelper = require('../test-helper/test-helper')

const _msg = testHelper.msg
const PresenceHandler = require('../../src/presence/presence-handler')

const queryMessage = {
  topic: C.TOPIC.PRESENCE,
  action: C.ACTIONS.QUERY,
  data: []
}

const presenceHandler = new PresenceHandler(testHelper.getDeepstreamOptions())

const userOne = new SocketWrapper(new SocketMock(), {}); userOne.user = 'Homer'
const userTwo = new SocketWrapper(new SocketMock(), {}); userTwo.user = 'Marge'
const userTwoAgain = new SocketWrapper(new SocketMock(), {}); userTwoAgain.user = 'Marge'
const userThree = new SocketWrapper(new SocketMock(), {}); userThree.user = 'Bart'

describe('presence handler', () => {
  beforeEach(() => {
    userOne.socket.lastSendMessage = null
    userTwo.socket.lastSendMessage = null
    userThree.socket.lastSendMessage = null
  })

  it('adds client and subscribes to client logins and logouts', () => {
    presenceHandler.handleJoin(userOne)

    const subJoinMsg = { topic: C.TOPIC.PRESENCE, action: C.ACTIONS.SUBSCRIBE, data: [] }
    presenceHandler.handle(userOne, subJoinMsg)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|A|S|U+'))
  })

  it('does not return own name when queried and only user', () => {
    presenceHandler.handle(userOne, queryMessage)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|Q+'))
  })

  it('adds a client and notifies original client', () => {
    presenceHandler.handleJoin(userTwo)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|PNJ|Marge+'))
  })

  it('returns one user when queried', () => {
    presenceHandler.handle(userOne, queryMessage)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|Q|Marge+'))
  })

  it('same username having another connection does not send an update', () => {
    presenceHandler.handleJoin(userTwoAgain)
    expect(userOne.socket.lastSendMessage).toBeNull()
  })

  it('add another client and only subscribed clients get notified', () => {
    presenceHandler.handleJoin(userThree)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|PNJ|Bart+'))
    expect(userTwo.socket.lastSendMessage).toBeNull()
    expect(userThree.socket.lastSendMessage).toBeNull()
  })

  it('a duplicate client logs out and subscribed clients are not notified', () => {
    presenceHandler.handleLeave(userTwoAgain)
    expect(userOne.socket.lastSendMessage).toBeNull()
    expect(userTwo.socket.lastSendMessage).toBeNull()
    expect(userThree.socket.lastSendMessage).toBeNull()
  })

  it('returns multiple uses when queried', () => {
    presenceHandler.handle(userOne, queryMessage)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|Q|Marge|Bart+'))
  })

  it('client three disconnects', () => {
    presenceHandler.handleLeave(userThree)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|PNL|Bart+'))
    expect(userTwo.socket.lastSendMessage).toBeNull()
    expect(userThree.socket.lastSendMessage).toBeNull()
  })

  it('client one gets acks after unsubscribes', () => {
    const unsubJoinMsg = { topic: C.TOPIC.PRESENCE, action: C.ACTIONS.UNSUBSCRIBE, data: [] }
    presenceHandler.handle(userOne, unsubJoinMsg)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|A|US|U+'))
  })

  it('client one does not get notified after unsubscribes', () => {
    presenceHandler.handleLeave(userTwo)
    expect(userOne.socket.lastSendMessage).toBeNull()

    presenceHandler.handleJoin(userThree)
    expect(userOne.socket.lastSendMessage).toBeNull()
  })
})
