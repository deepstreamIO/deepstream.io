import ListenerTestUtils from './listener-test-utils'

let tu

describe('listener-registry-local-timeouts', () => {
  beforeEach(() => {
    tu = new ListenerTestUtils()
  })

  afterEach(() => {
    tu.complete()
  })

  beforeEach(() => {
    // 1. provider 1 does listen a/.*
    tu.providerListensTo(1, 'a/.*')
    // 2. provider 2 does listen a/[0-9]
    tu.providerListensTo(2, 'a/[0-9]')
    // 3.  client 1 requests a/1
    tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
    tu.clientSubscribesTo(1, 'a/1', true)
  })

  it('provider 1 times out, provider 2 accepts', (done) => {
    tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')
    tu.publishUpdateWillBeSentToSubscribers('a/1', true)

    setTimeout(() => {
      tu.providerAccepts(1, 'a/[0-9]', 'a/1')
      tu.subscriptionHasActiveProvider('a/1', true)
      done()
    }, 40)
  })

  it('provider 1 times out, but then it accepts but will be ignored because provider 2 accepts as well', (done) => {
    tu.providerWillGetSubscriptionRemoved(1, 'a/.*', 'a/1')
    tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')

    setTimeout(() => {
      tu.providerAcceptsButIsntAcknowledged(1, 'a/.*', 'a/1')

      tu.publishUpdateWillBeSentToSubscribers('a/1', true)
      tu.providerAccepts(2, 'a/[0-9]', 'a/1')

      tu.subscriptionHasActiveProvider('a/1', true)
      done()
    }, 40)
  })

  it('provider 1 times out, but then it accept and will be used because provider 2 rejects', (done) => {
    tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')

    setTimeout(() => {
      tu.providerAcceptsButIsntAcknowledged(1, 'a/.*', 'a/1')
      tu.subscriptionHasActiveProvider('a/1', false)

      tu.publishUpdateWillBeSentToSubscribers('a/1', true)
      tu.providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed(2, 'a/[0-9]', 'a/1')
      tu.subscriptionHasActiveProvider('a/1', true)
      done()
    }, 40)
  })

  it('provider 1 and 2 times out and 3 rejects, 1 rejects and 2 accepts later and 2 wins', (done) => {
    tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')

    tu.providerListensTo(3, 'a/[1]')

    setTimeout(() => {
      tu.providerWillGetSubscriptionFound(3, 'a/[1]', 'a/1')
      // first provider timeout
      setTimeout(() => {
        tu.providerRejects(1, 'a/.*', 'a/1')

        tu.providerAcceptsButIsntAcknowledged(2, 'a/[0-9]', 'a/1')

        tu.publishUpdateWillBeSentToSubscribers('a/1', true)
        tu.providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed(3, 'a/[1]', 'a/1')
        done()
      }, 40)
    }, 40)
  })

  xit('1 rejects and 2 accepts later and dies and 3 wins', (done) => {
    tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')
    tu.providerListensTo(3, 'a/[1]')

    setTimeout(() => {
      tu.providerWillGetSubscriptionFound(3, 'a/[1]', 'a/1')
      // first provider timeout
      setTimeout(() => {
        tu.providerRejects(1, 'a/.*', 'a/1')

        tu.providerAcceptsButIsntAcknowledged(2, 'a/[0-9]', 'a/1')

        tu.providerLosesItsConnection(2, 'a/[0-9]')

        tu.providerRejects(3, 'a/[1]', 'a/1')
        done()
      }, 40)
    }, 40)
  })

  // TODO: One of those magical timeouts that randomly fail other tests
  it('provider 1 and 2 times out and 3 rejects, 1 and 2 accepts later and 1 wins', (done) => {
    tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')
    tu.providerListensTo(3, 'a/[1]')

    setTimeout(() => {
      tu.providerWillGetSubscriptionFound(3, 'a/[1]', 'a/1')
    // first provider
      setTimeout(() => {
    // 10. provider 1 responds with ACCEPT
        tu.providerAcceptsButIsntAcknowledged(1, 'a/.*', 'a/1')
    // 11. provider 2 responds with ACCEPT
        tu.providerAcceptsAndIsSentSubscriptionRemoved(2, 'a/[0-9]', 'a/1')
    // 12. provider 3 responds with reject
        tu.publishUpdateWillBeSentToSubscribers('a/1', true)
        tu.providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed(3, 'a/[1]', 'a/1')
        done()
      }, 40)
    }, 40)
  })
})
