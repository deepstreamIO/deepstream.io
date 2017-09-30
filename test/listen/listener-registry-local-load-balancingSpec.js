/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ListenerTestUtils = require('./listener-test-utils')

let tu

describe('listener-registry-local-load-balancing', () => {
  beforeEach(() => {
    tu = new ListenerTestUtils()
  })

  describe('with a single provider', () => {
    it('accepts a subscription', () => {
      // 1.  provider does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 2.  clients 1 request a/1
      tu.clientSubscribesTo(1, 'a/1', true)
      // 3.  provider gets a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      // 4.  provider responds with ACCEPT
      tu.providerAccepts(1, 'a/.*', 'a/1')
      // 5.  send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
      // 6.  clients 2 request a/1
      tu.clientSubscribesTo(2, 'a/1')
      tu.clientRecievesPublishedUpdate(2, 'a/1', true)
      // 6.  clients 3 request a/1
      tu.clientSubscribesTo(3, 'a/1')
      tu.clientRecievesPublishedUpdate(3, 'a/1', true)
      // 7. provider should not get a SR
      tu.providerRecievedNoNewMessages(1)
      // 9.  client 1 discards a/1
      tu.clientUnsubscribesTo(3, 'a/1')
      tu.nothingHappened()
      // 9.  client 2 discards a/1
      tu.clientUnsubscribesTo(2, 'a/1')
      tu.nothingHappened()
      // 10.  clients discards a/1
      tu.clientUnsubscribesTo(1, 'a/1', true)
      // 11.  provider gets a SR
      tu.providerGetsSubscriptionRemoved(1, 'a/.*', 'a/1')
      // 12.  send publishing=false to the clients
      tu.publishUpdateSentToSubscribers('a/1', false)
      // 13.  a/1 should have no active provider
      tu.subscriptionHasActiveProvider('a/1', false)
      // 14. recieving unknown accept/reject throws an error
      tu.acceptMessageThrowsError(1, 'a/.*', 'a/1')
      tu.rejectMessageThrowsError(1, 'a/.*', 'a/1')
    })

    it('rejects a subscription', () => {
      // 1.  provider does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 2.  clients request a/1
      tu.clientSubscribesTo(1, 'a/1', true)
      // 3.  provider gets a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      // 4.  provider responds with ACCEPT
      tu.providerRejects(1, 'a/.*', 'a/1')
      // 5.  clients discards a/1
      tu.clientUnsubscribesTo(1, 'a/1', true)
      // 6. provider should not get a SR
      tu.providerRecievedNoNewMessages(1)
    })

    it('rejects a subscription with a pattern for which subscriptions already exists', () => {
      // 0. subscription already made for b/1
      tu.subscriptionAlreadyMadeFor('b/1')
      // 1. provider does listen a/.*
      tu.providerListensTo(1, 'b/.*')
      // 2. provider gets a SP
      tu.providerGetsSubscriptionFound(1, 'b/.*', 'b/1')
      // 3. provider responds with REJECT
      tu.providerRejects(1, 'b/.*', 'b/1')
      // 4. clients discards b/1
      tu.clientUnsubscribesTo(1, 'b/1', true)
      // 5. provider should not get a SR
      tu.providerRecievedNoNewMessages(1)
    })

    it('accepts a subscription with a pattern for which subscriptions already exists', () => {
      // 0. subscription already made for b/1
      tu.subscriptionAlreadyMadeFor('b/1')
      // 1. provider does listen a/.*
      tu.providerListensTo(1, 'b/.*')
      // 2. provider gets a SP
      tu.providerGetsSubscriptionFound(1, 'b/.*', 'b/1')
      // 3. provider responds with ACCEPT
      tu.providerAccepts(1, 'b/.*', 'b/1')
      // 4. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('b/1', true)
      // 5. clients discards b/1
      tu.clientUnsubscribesTo(1, 'b/1', true)
      // 6. provider should get a SR
      tu.providerGetsSubscriptionRemoved(1, 'b/.*', 'b/1')
      // 7. send publishing=false to the clients
      tu.publishUpdateSentToSubscribers('b/1', false)
    })

    it('accepts a subscription for 2 clients', () => {
      // 1. provider does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 2.  client 1 requests a/1
      tu.clientSubscribesTo(1, 'a/1', true)
      // 3. provider gets a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      // 4. provider responds with ACCEPT
      tu.providerAccepts(1, 'a/.*', 'a/1')
      // 5. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
      // 6. client 2 requests a/1
      tu.clientSubscribesTo(2, 'a/1')
      // 7. provider doesnt get told anything
      tu.providerRecievedNoNewMessages(1)
      // 8. client 2 gets publishing=true
      tu.clientRecievesPublishedUpdate(2, 'a/1', true)
      // 9.  client 1 discards a/1
      tu.clientUnsubscribesTo(1, 'a/1')
      // 10. client 2 recieved nothing
      tu.clientRecievedNoNewMessages(2)
      // 11.  client 2 discards a/1
      tu.clientUnsubscribesTo(2, 'a/1', true)
      // 12. provider should get a SR
      tu.providerGetsSubscriptionRemoved(1, 'a/.*', 'a/1')
      // 13. a/1 should have no active provider
      tu.subscriptionHasActiveProvider('a/1', false)
    })
  })

  describe('with multiple providers', () => {
    it('first rejects, seconds accepts, third does nothing', () => {
      // 1. provider 1 does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 2. provider 2 does listen a/[0-9]
      tu.providerListensTo(2, 'a/[0-9]')
      // 3.  client 1 requests a/1
      tu.clientSubscribesTo(1, 'a/1', true)
      // 4. provider 1 gets a SP and provider 2 should not get a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      tu.providerRecievedNoNewMessages(2)
      // 5. provider 1 responds with REJECTS
      tu.providerRejects(1, 'a/.*', 'a/1')
      // 6 provider 2 should get a SP and provider 1 should not get a SP
      tu.providerRecievedNoNewMessages(1)
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      // 7. provider 2 responds with ACCEPTS
      tu.providerAccepts(2, 'a/[0-9]', 'a/1')
      // 8. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
      // 9. provider 3 does listen a/[0-9]
      tu.providerListensTo(3, 'a/[0-9]')
      // 10. providers get nothing
      tu.providerRecievedNoNewMessages(1)
      tu.providerRecievedNoNewMessages(2)
      tu.providerRecievedNoNewMessages(3)
      // 11. client 1 unsubscribed to a/1
      tu.clientUnsubscribesTo(1, 'a/1', true)
      // 12. provider 2 gets a SR and provider 1 gets nothing
      tu.providerRecievedNoNewMessages(1)
      tu.providerGetsSubscriptionRemoved(2, 'a/[0-9]', 'a/1')
      // 13. send publishing=false to the clients
      tu.publishUpdateSentToSubscribers('a/1', false)
    })

    it('first accepts, seconds does nothing', () => {
      // 1. provider 1 does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 2. provider 2 does listen a/[0-9]
      tu.providerListensTo(2, 'a/[0-9]')
      // 3.  client 1 requests a/1
      tu.clientSubscribesTo(1, 'a/1', true)
      // 4. provider 1 gets a SP and provider 2 should not get a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      tu.providerRecievedNoNewMessages(2)
      // 5. provider 2 does not get sent anything
      tu.providerRecievedNoNewMessages(2)
      // 6. provider 1 accepts
      tu.providerAccepts(1, 'a/.*', 'a/1')
      // 12. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
      // 6. client 1 unsubscribed to a/1
      tu.clientUnsubscribesTo(1, 'a/1', true)
      // 10. provider 1 gets a SR and provider 2 gets nothing
      tu.providerGetsSubscriptionRemoved(1, 'a/.*', 'a/1')
      tu.providerRecievedNoNewMessages(2)
      // 12. send publishing=false to the clients
      tu.publishUpdateSentToSubscribers('a/1', false)
    })

    it('first rejects, seconds - which start listening after first gets SP - accepts', () => {
      // 1. provider 1 does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 3.  client 1 requests a/1
      tu.clientSubscribesTo(1, 'a/1', true)
      // 4. provider 1 gets a SP and provider 2 should not get a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      // 2. provider 2 does listen a/[0-9]
      tu.providerListensTo(2, 'a/[0-9]')
      // 6. provider 1 rejects
      tu.providerRejects(1, 'a/.*', 'a/1')
      // 10. provider 1 gets a SR and provider 2 gets nothing
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      tu.providerRecievedNoNewMessages(1)
      // 6. provider 1 accepts
      tu.providerAccepts(2, 'a/[0-9]', 'a/1')
      // 12. send publishing=false to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
    })

    it('no messages after unlisten', () => {
      // 1. provider 1 does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 2. provider 2 does listen a/[0-9]
      tu.providerListensTo(2, 'a/[0-9]')
      // 3.  client 1 requests a/1
      tu.clientSubscribesTo(1, 'a/1', true)
      // 4. provider 1 gets a SP and provider 2 should not get a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      tu.providerRecievedNoNewMessages(2)
      // 2. provider 2 does unlisten a/[0-9]
      tu.providerUnlistensTo(2, 'a/[0-9]')
      // 6. provider 1 responds with REJECTS
      tu.providerRejects(1, 'a/.*', 'a/1')
      // 7
      tu.providerRecievedNoNewMessages(1)
      tu.providerRecievedNoNewMessages(2)
    })

    it('provider 1 accepts a subscription and disconnects then provider 2 gets a SP', () => {
      // 1. provider 1 does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 2. provider 2 does listen a/[0-9]
      tu.providerListensTo(2, 'a/[0-9]')
      // 3.  client 1 requests a/1
      tu.clientSubscribesTo(1, 'a/1', true)
      // 4. provider 1 gets a SP and provider 2 should not get a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      tu.providerRecievedNoNewMessages(2)
      // 5. provider 1 responds with ACCEPT
      tu.providerAccepts(1, 'a/.*', 'a/1')
      // 13. subscription has active provider
      tu.subscriptionHasActiveProvider('a/1', true)
      // 7.  client 1 requests a/1
      tu.providerLosesItsConnection(1)
      // 8. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', false)
      // 9. subscription doesnt have active provider
      tu.subscriptionHasActiveProvider('a/1', false)
      // 10. provider 1 gets a SP and provider 2 should not get a SP
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      // 11. provider 1 responds with ACCEPT
      tu.providerAccepts(2, 'a/[0-9]', 'a/1')
      // 12. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
      // 13. subscription has active provider
      tu.subscriptionHasActiveProvider('a/1', true)
    })
  })
})

describe('listener-registry-local-load-balancing does not send publishing updates for events', () => {
  beforeEach(() => {
    tu = new ListenerTestUtils('E')
  })

  it('client with provider already registered', () => {
    // 1. provider does listen a/.*
    tu.providerListensTo(1, 'a/.*')
    // 2.  client 1 requests a/1
    tu.clientSubscribesTo(1, 'a/1', true)
    // 3. provider gets a SP
    tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
    // 4. provider responds with ACCEPT
    tu.providerAccepts(1, 'a/.*', 'a/1')
    // 5. send publishing=true to the clients
    tu.publishUpdateIsNotSentToSubscribers()
    // 6. client 2 requests a/1
    tu.clientSubscribesTo(2, 'a/1')
    // 7. provider doesnt get told anything
    tu.providerRecievedNoNewMessages(1)
    // 8. client 2 gets publishing=true
    tu.clientDoesNotRecievePublishedUpdate(2)
    // 9.  client 1 discards a/1
    tu.clientUnsubscribesTo(1, 'a/1')
    // 10. client 2 recieved nothing
    tu.clientRecievedNoNewMessages(2)
    // 11.  client 2 discards a/1
    tu.clientUnsubscribesTo(2, 'a/1', true)
    // 12. provider should get a SR
    tu.providerGetsSubscriptionRemoved(1, 'a/.*', 'a/1')
    // 13. a/1 should have no active provider
    tu.subscriptionHasActiveProvider('a/1', false)
    // 14. do notsend publishing=false to the clients
    tu.publishUpdateIsNotSentToSubscribers()
  })
})
