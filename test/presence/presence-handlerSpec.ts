'use strict'

const PresenceHandler = require('../../src/presence/presence-handler').default

const EVERYONE = '%_EVERYONE_%'

import * as C from '../../src/constants'
const testHelper = require('../test-helper/test-helper')
import { getTestMocks } from '../test-helper/test-mocks'

const options = testHelper.getDeepstreamOptions()
const config = options.config
const services = options.services

describe('presence handler', () => {
  let testMocks
  let presenceHandler
  let userOne

  beforeEach(() => {
    testMocks = getTestMocks()
    presenceHandler = new PresenceHandler(
      config, services, testMocks.subscriptionRegistry, testMocks.stateRegistry
    )
    userOne = testMocks.getSocketWrapper('Marge')
  })

  afterEach(() => {
    testMocks.subscriptionRegistryMock.verify()
    testMocks.listenerRegistryMock.verify()
    userOne.socketWrapperMock.verify()
  })

  it('subscribes to client logins and logouts', () => {
    const subscriptionMessage = {
      topic: C.TOPIC.EVENT,
      action: C.PRESENCE_ACTIONS.SUBSCRIBE,
      data: 'S'
    }

    testMocks.subscriptionRegistryMock
      .expects('subscribe')
      .once()
      .withExactArgs({
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.SUBSCRIBE,
        name: EVERYONE
      }, userOne.socketWrapper)

    presenceHandler.handle(userOne.socketWrapper, subscriptionMessage)
  })

  it('unsubscribes to client logins and logouts', () => {
    const unsubscriptionMessage = {
      topic: C.TOPIC.EVENT,
      action: C.PRESENCE_ACTIONS.UNSUBSCRIBE,
      data: 'S'
    }

    testMocks.subscriptionRegistryMock
      .expects('unsubscribe')
      .once()
      .withExactArgs({
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.UNSUBSCRIBE,
        name: EVERYONE
      }, userOne.socketWrapper)

    presenceHandler.handle(userOne.socketWrapper, unsubscriptionMessage)
  })

  it('does not return own name when queried and only user', () => {
    const queryMessage = {
      topic: C.TOPIC.PRESENCE,
      action: C.PRESENCE_ACTIONS.QUERY_ALL,
      name: C.PRESENCE_ACTIONS.QUERY_ALL
    }

    testMocks.stateRegistryMock
      .expects('getAll')
      .once()
      .withExactArgs()
      .returns(['Marge'])

    userOne.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE,
        parsedData: []
      })

    presenceHandler.handle(userOne.socketWrapper, queryMessage)
  })

  it('client joining gets added to state registry', () => {
    testMocks.stateRegistryMock
      .expects('add')
      .once()
      .withExactArgs(userOne.socketWrapper.user)

    presenceHandler.handleJoin(userOne.socketWrapper)
  })

  it('client joining multiple times gets added once state registry', () => {
    testMocks.stateRegistryMock
      .expects('add')
      .once()
      .withExactArgs(userOne.socketWrapper.user)

    presenceHandler.handleJoin(userOne.socketWrapper)
    presenceHandler.handleJoin(userOne.socketWrapper)
  })

  it('a duplicate client logs out does not remove from state', () => {
    testMocks.stateRegistryMock
      .expects('add')
      .once()
      .withExactArgs(userOne.socketWrapper.user)

    testMocks.stateRegistryMock
      .expects('remove')
      .never()

    presenceHandler.handleJoin(userOne.socketWrapper)
    presenceHandler.handleJoin(userOne.socketWrapper)
    presenceHandler.handleLeave(userOne.socketWrapper)
  })

  it('a client logging out removes from state', () => {
    testMocks.stateRegistryMock
      .expects('add')
      .once()
      .withExactArgs(userOne.socketWrapper.user)

    testMocks.stateRegistryMock
      .expects('remove')
      .once()
      .withExactArgs(userOne.socketWrapper.user)

    presenceHandler.handleJoin(userOne.socketWrapper)
    presenceHandler.handleLeave(userOne.socketWrapper)
  })

  it('returns one user when queried', () => {
    const queryMessage = {
      topic: C.TOPIC.PRESENCE,
      action: C.PRESENCE_ACTIONS.QUERY_ALL,
    }

    testMocks.stateRegistryMock
      .expects('getAll')
      .once()
      .withExactArgs()
      .returns(['Bart'])

    userOne.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE,
        parsedData: ['Bart']
      })

    presenceHandler.handle(userOne.socketWrapper, queryMessage)
  })

  it('returns mutiple user when queried', () => {
    const queryMessage = {
      topic: C.TOPIC.PRESENCE,
      action: C.PRESENCE_ACTIONS.QUERY_ALL,
      name: C.PRESENCE_ACTIONS.QUERY_ALL
    }

    testMocks.stateRegistryMock
      .expects('getAll')
      .once()
      .withExactArgs()
      .returns(['Bart', 'Homer', 'Maggie'])

    userOne.socketWrapperMock
      .expects('sendMessage')
      .once()
      .withExactArgs({
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.QUERY_ALL_RESPONSE,
        parsedData: ['Bart', 'Homer', 'Maggie']
      })

    presenceHandler.handle(userOne.socketWrapper, queryMessage)
  })

  it('notifies subscribed users when user added to state', () => {
    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(EVERYONE, {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.PRESENCE_JOIN,
        name: 'Bart'
      }, false, null, false)

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs('Bart', {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.PRESENCE_JOIN,
        name: 'Bart'
      }, false, null, false)

    testMocks.stateRegistry.emit('add', 'Bart')
  })

  it('notifies subscribed users when user removed from state', () => {
    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(EVERYONE, {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.PRESENCE_LEAVE,
        name: 'Bart'
      }, false, null, false)

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs('Bart', {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTIONS.PRESENCE_LEAVE,
        name: 'Bart'
      }, false, null, false)

    testMocks.stateRegistry.emit('remove', 'Bart')
  })
})
