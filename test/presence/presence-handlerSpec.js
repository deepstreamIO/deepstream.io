/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let EventEmitter = require('events').EventEmitter
const PresenceHandler = require('../../src/presence/presence-handler')
const SocketWrapper = require('../../src/message/socket-wrapper')
const C = require('../../src/constants/constants')
const _msg = require('../test-helper/test-helper').msg
const SocketMock = require('../mocks/socket-mock')
const messageConnectorMock = new (require('../mocks/message-connector-mock'))()
const clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))()
const LoggerMock = require('../mocks/logger-mock')
const options = {
  clusterRegistry: clusterRegistryMock,
  serverName: 'server-name-a',
  stateReconciliationTimeout: 10,
  messageConnector: messageConnectorMock,
  logger: new LoggerMock(),
  connectionEndpoint: new EventEmitter()
}
const queryMessage = {
  topic: C.TOPIC.PRESENCE,
  action: C.ACTIONS.QUERY,
  data: null
}
const presenceHandler = new PresenceHandler(options)

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
    options.connectionEndpoint.emit('client-connected', userOne)

    const subJoinMsg = { topic: C.TOPIC.PRESENCE, action: C.ACTIONS.SUBSCRIBE, data: [] }
    presenceHandler.handle(userOne, subJoinMsg)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|A|S|U+'))
  })

  it('does not return own name when queried and only user', () => {
    presenceHandler.handle(userOne, queryMessage)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|Q+'))
  })

  it('adds a client and notifies original client', () => {
    options.connectionEndpoint.emit('client-connected', userTwo)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|PNJ|Marge+'))
  })

  it('returns one user when queried', () => {
    presenceHandler.handle(userOne, queryMessage)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|Q|Marge+'))
  })

  it('same username having another connection does not send an update', () => {
    options.connectionEndpoint.emit('client-connected', userTwoAgain)
    expect(userOne.socket.lastSendMessage).toBeNull()
  })

  it('add another client and only subscribed clients get notified', () => {
    options.connectionEndpoint.emit('client-connected', userThree)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|PNJ|Bart+'))
    expect(userTwo.socket.lastSendMessage).toBeNull()
    expect(userThree.socket.lastSendMessage).toBeNull()
  })

  it('a duplicate client logs out and subscribed clients are not notified', () => {
    options.connectionEndpoint.emit('client-disconnected', userTwoAgain)
    expect(userOne.socket.lastSendMessage).toBeNull()
    expect(userTwo.socket.lastSendMessage).toBeNull()
    expect(userThree.socket.lastSendMessage).toBeNull()
  })

  it('returns multiple uses when queried', () => {
    presenceHandler.handle(userOne, queryMessage)
    expect(userOne.socket.lastSendMessage).toBe(_msg('U|Q|Marge|Bart+'))
  })

  it('client three disconnects', () => {
    options.connectionEndpoint.emit('client-disconnected', userThree)
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
    options.connectionEndpoint.emit('client-disconnected', userTwo)
    expect(userOne.socket.lastSendMessage).toBeNull()

    options.connectionEndpoint.emit('client-connected', userThree)
    expect(userOne.socket.lastSendMessage).toBeNull()
  })
})
