/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ListenerTestUtils = require('./listener-test-utils')

let tu

describe('listener-registry-local-timeouts', () => {
  beforeEach(() => {
    tu = new ListenerTestUtils()
  })

  beforeEach(() => {
    // 1. provider 1 does listen a/.*
    tu.providerListensTo(1, 'a/.*')
    // 2. provider 2 does listen a/[0-9]
    tu.providerListensTo(2, 'a/[0-9]')
    // 3.  client 1 requests a/1
    tu.clientSubscribesTo(1, 'a/1', true)
    // 4. provider 1 gets a SP and provider 2 should not get a SP
    tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
    tu.providerRecievedNoNewMessages(2)
  })

  it('provider 1 times out, provider 2 accepts', (done) => {
    // 5. Timeout occurs
    setTimeout(() => {
    // 6. provider 2 gets a SP
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      tu.providerRecievedNoNewMessages(1)
    // 7. provider 1 responds with ACCEPT
      tu.providerAccepts(1, 'a/[0-9]', 'a/1')
    // 8. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
    // 9. subscription doesnt have active provider
      tu.subscriptionHasActiveProvider('a/1', true)
    // 9
      tu.providerRecievedNoNewMessages(2)
      done()
    }, 40)
  })

  it('provider 1 times out, but then it accepts but will be ignored because provider 2 accepts as well', (done) => {
    // 5. Timeout occurs
    setTimeout(() => {
    // 6. provider 2 gets a SP
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      tu.providerRecievedNoNewMessages(1)
    // 7. provider 1 responds with ACCEPT
      tu.providerAcceptsButIsntAcknowledged(1, 'a/.*', 'a/1')
    // 8. client 1 recieves no update
      tu.providerRecievedNoNewMessages(1)
    // 9. provider 2 responds with ACCEPT
      tu.providerAccepts(2, 'a/[0-9]', 'a/1')
    // 10. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
    // 11. subscription doesnt have active provider
      tu.subscriptionHasActiveProvider('a/1', true)
    // 12. provider 1 gets a SR and provider 2 gets nothing
      tu.providerGetsSubscriptionRemoved(1, 'a/.*', 'a/1')
      tu.providerRecievedNoNewMessages(2)
      done()
    }, 40)
  })

  it('provider 1 times out, but then it accept and will be used because provider 2 rejects', (done) => {
    // 5. Timeout occurs
    setTimeout(() => {
    // 6. provider 2 gets a SP
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      tu.providerRecievedNoNewMessages(1)
    // 7. provider 1 responds with ACCEPT
      tu.providerAcceptsButIsntAcknowledged(1, 'a/.*', 'a/1')
    // 8. subscription doesnt have active provider
      tu.subscriptionHasActiveProvider('a/1', false)
    // 9. provider 2 rejects and provider 2 accepts is used
      tu.providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed(2, 'a/[0-9]', 'a/1')
    // 10. send publishing=true to the clients
      tu.publishUpdateSentToSubscribers('a/1', true)
    // 11. subscription doesnt have active provider
      tu.subscriptionHasActiveProvider('a/1', true)
      done()
    }, 40)
  })

  it('provider 1 and 2 times out and 3 rejects, 1 rejects and 2 accepts later and 2 wins', (done) => {
    // 5. provider 3 does listen a/[1]
    tu.providerListensTo(3, 'a/[1]')
    // 6. Timeout occurs
    setTimeout(() => {
    // 7. Provider 2 gets subscription found
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      tu.providerRecievedNoNewMessages(1)
      tu.providerRecievedNoNewMessages(3)
    // 8. Timeout occurs
      setTimeout(() => {
    // 9. Provider 3 gets subscription found
        tu.providerGetsSubscriptionFound(3, 'a/[1]', 'a/1')
        tu.providerRecievedNoNewMessages(1)
        tu.providerRecievedNoNewMessages(2)
    // 10. provider 1 responds with ACCEPT
        tu.providerRejects(1, 'a/.*', 'a/1')
    // 11. provider 2 responds with ACCEPT
        tu.providerAcceptsButIsntAcknowledged(2, 'a/[0-9]', 'a/1')
    // 12. provider 3 responds with reject
        tu.providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed(3, 'a/[1]', 'a/1')
    // 13. send publishing=true to the clients
        tu.publishUpdateSentToSubscribers('a/1', true)
    // 14. First provider is not sent anything
        tu.providerRecievedNoNewMessages(1)
        done()
      }, 40)
    }, 40)
  })

  it('1 rejects and 2 accepts later and dies and 3 wins', (done) => {
    // 5. provider 3 does listen a/[1]
    tu.providerListensTo(3, 'a/[1]')
    // 6. Timeout occurs
    setTimeout(() => {
    // 7. Provider 2 gets subscription found
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      tu.providerRecievedNoNewMessages(1)
      tu.providerRecievedNoNewMessages(3)
    // 8. Timeout occurs
      setTimeout(() => {
    // 9. Provider 3 gets subscription found
        tu.providerGetsSubscriptionFound(3, 'a/[1]', 'a/1')
        tu.providerRecievedNoNewMessages(1)
        tu.providerRecievedNoNewMessages(2)
    // 10. provider 1 responds with ACCEPT
        tu.providerRejects(1, 'a/.*', 'a/1')
    // 11. provider 2 responds with ACCEPT
        tu.providerAcceptsButIsntAcknowledged(2, 'a/[0-9]', 'a/1')
    // 12. provider 2 dies
        tu.providerLosesItsConnection(2, 'a/[0-9]')
    // // 13. provider 3 responds with reject
        tu.providerRejects(3, 'a/[1]', 'a/1')
    // // 14. send publishing=true to the clients
        tu.publishUpdateIsNotSentToSubscribers()
        done()
      }, 40)
    }, 40)
  })

  // TODO: One of those magical timeouts that randomly fail other tests
  it('provider 1 and 2 times out and 3 rejects, 1 and 2 accepts later and 1 wins', (done) => {
    // 5. provider 3 does listen a/[1]
    tu.providerListensTo(3, 'a/[1]')
    // 6. Timeout occurs
    setTimeout(() => {
    // 7. Provider 2 gets subscription found
      tu.providerGetsSubscriptionFound(2, 'a/[0-9]', 'a/1')
      tu.providerRecievedNoNewMessages(1)
      tu.providerRecievedNoNewMessages(3)
    // 8. Timeout occurs
      setTimeout(() => {
    // 9. Provider 3 gets subscription found
        tu.providerGetsSubscriptionFound(3, 'a/[1]', 'a/1')
        tu.providerRecievedNoNewMessages(1)
        tu.providerRecievedNoNewMessages(2)
    // 10. provider 1 responds with ACCEPT
        tu.providerAcceptsButIsntAcknowledged(1, 'a/.*', 'a/1')
    // 11. provider 2 responds with ACCEPT
        tu.providerAcceptsAndIsSentSubscriptionRemoved(2, 'a/[0-9]', 'a/1')
    // 12. provider 3 responds with reject
        tu.providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed(3, 'a/[1]', 'a/1')
    // 13. send publishing=true to the clients
        tu.publishUpdateSentToSubscribers('a/1', true)
    // 14. First provider is not sent anything
        tu.providerRecievedNoNewMessages(1)
        done()
      }, 40)
    }, 40)
  })
})
