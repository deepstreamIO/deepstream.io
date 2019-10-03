import 'mocha'

import PresenceHandler from './presence-handler'

const EVERYONE = '%_EVERYONE_%'

import * as C from '../../constants'
import * as testHelper from '../../test/helper/test-helper'
import { getTestMocks } from '../../test/helper/test-mocks'
import { PresenceMessage } from '../../../../client/dist/constants'

const { config, services } = testHelper.getDeepstreamOptions()

describe('presence handler', () => {
  let testMocks
  let presenceHandler: PresenceHandler
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
      topic: C.TOPIC.PRESENCE,
      action: C.PRESENCE_ACTION.SUBSCRIBE_ALL,
    } as PresenceMessage

    testMocks.subscriptionRegistryMock
      .expects('subscribe')
      .once()
      .withExactArgs(EVERYONE, {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTION.SUBSCRIBE_ALL,
        name: EVERYONE
      }, userOne.socketWrapper, true)

    presenceHandler.handle(userOne.socketWrapper, subscriptionMessage)
  })

  it('unsubscribes to client logins and logouts', () => {
    const unsubscriptionMessage = {
      topic: C.TOPIC.PRESENCE,
      action: C.PRESENCE_ACTION.UNSUBSCRIBE_ALL,
    } as PresenceMessage

    testMocks.subscriptionRegistryMock
      .expects('unsubscribe')
      .once()
      .withExactArgs(EVERYONE, {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTION.UNSUBSCRIBE_ALL,
        name: EVERYONE
      }, userOne.socketWrapper, true)

    presenceHandler.handle(userOne.socketWrapper, unsubscriptionMessage)
  })

  it('does not return own name when queried and only user', () => {
    const queryMessage = {
      topic: C.TOPIC.PRESENCE,
      action: C.PRESENCE_ACTION.QUERY_ALL
    } as PresenceMessage

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
        action: C.PRESENCE_ACTION.QUERY_ALL_RESPONSE,
        names: []
      })

    presenceHandler.handle(userOne.socketWrapper, queryMessage)
  })

  it('client joining gets added to state registry', () => {
    testMocks.stateRegistryMock
      .expects('add')
      .once()
      .withExactArgs(userOne.socketWrapper.userId)

    presenceHandler.onClientConnected(userOne.socketWrapper)
  })

  it('client joining multiple times gets added once state registry', () => {
    testMocks.stateRegistryMock
      .expects('add')
      .once()
      .withExactArgs(userOne.socketWrapper.userId)

    presenceHandler.onClientConnected(userOne.socketWrapper)
    presenceHandler.onClientConnected(userOne.socketWrapper)
  })

  it('a duplicate client logs out does not remove from state', () => {
    testMocks.stateRegistryMock
      .expects('add')
      .once()
      .withExactArgs(userOne.socketWrapper.userId)

    testMocks.stateRegistryMock
      .expects('remove')
      .never()

    presenceHandler.onClientConnected(userOne.socketWrapper)
    presenceHandler.onClientConnected(userOne.socketWrapper)
    presenceHandler.onClientDisconnected(userOne.socketWrapper)
  })

  it('a client logging out removes from state', () => {
    testMocks.stateRegistryMock
      .expects('add')
      .once()
      .withExactArgs(userOne.socketWrapper.userId)

    testMocks.stateRegistryMock
      .expects('remove')
      .once()
      .withExactArgs(userOne.socketWrapper.userId)

    presenceHandler.onClientConnected(userOne.socketWrapper)
    presenceHandler.onClientDisconnected(userOne.socketWrapper)
  })

  it('returns one user when queried', () => {
    const queryMessage = {
      topic: C.TOPIC.PRESENCE,
      action: C.PRESENCE_ACTION.QUERY_ALL,
    } as PresenceMessage

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
        action: C.PRESENCE_ACTION.QUERY_ALL_RESPONSE,
        names: ['Bart']
      })

    presenceHandler.handle(userOne.socketWrapper, queryMessage)
  })

  it('returns mutiple user when queried', () => {
    const queryMessage = {
      topic: C.TOPIC.PRESENCE,
      action: C.PRESENCE_ACTION.QUERY_ALL
    } as PresenceMessage

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
        action: C.PRESENCE_ACTION.QUERY_ALL_RESPONSE,
        names: ['Bart', 'Homer', 'Maggie']
      })

    presenceHandler.handle(userOne.socketWrapper, queryMessage)
  })

  it.skip('notifies subscribed users when user added to state', () => {
    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(EVERYONE, {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTION.PRESENCE_JOIN_ALL,
        name: 'Bart'
      }, false, null, false)

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs('Bart', {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTION.PRESENCE_JOIN,
        name: 'Bart'
      }, false, null, false)

      // This needs extra work
    testMocks.stateRegistry.add('Bart')
  })

  it.skip('notifies subscribed users when user removed from state', () => {
    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs(EVERYONE, {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTION.PRESENCE_LEAVE_ALL,
        name: 'Bart'
      }, false, null, false)

    testMocks.subscriptionRegistryMock
      .expects('sendToSubscribers')
      .once()
      .withExactArgs('Bart', {
        topic: C.TOPIC.PRESENCE,
        action: C.PRESENCE_ACTION.PRESENCE_LEAVE,
        name: 'Bart'
      }, false, null, false)

    testMocks.stateRegistry.emit('remove', 'Bart')
  })
})
