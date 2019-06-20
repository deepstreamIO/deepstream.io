import 'mocha'

import * as C from '../constants'
import ListenerTestUtils from './listener-test-utils'

import 'mocha'

let tu

describe('listener-registry', () => {
/*
const ListenerRegistry = require('../../src/listen/listener-registry')
const testHelper = require('../test-helper/test-helper')
import SocketMock from '../test-mocks/socket-mock'

const options = testHelper.getDeepstreamOptions()
const msg = testHelper.msg
let listenerRegistry

const recordSubscriptionRegistryMock = {
  getNames () {
    return ['car/Mercedes', 'car/Abarth']
  }
}

describe.skip('listener-registry errors', () => {
  beforeEach(() => {
    listenerRegistry = new ListenerRegistry('R', options, recordSubscriptionRegistryMock)
    expect(typeof listenerRegistry.handle).to.equal('function')
  })

  it('adds a listener without message data', () => {
    const socketWrapper = SocketWrapperFactory.create(new SocketMock(), options)
    listenerRegistry.handle(socketWrapper, {
      topic: 'R',
      action: 'L',
      data: []
    })
    expect(options.logger.lastLogArguments).to.deep.equal([3, 'INVALID_MESSAGE_DATA', undefined])
    expect(socketWrapper.socket.lastSendMessage).to.equal(msg('R|E|INVALID_MESSAGE_DATA|undefined+'))
  })

  it('adds a listener with invalid message data message data', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), options)
    listenerRegistry.handle(socketWrapper, {
      topic: 'R',
      action: 'L',
      data: [44]
    })
    expect(options.logger.lastLogArguments).to.deep.equal([3, 'INVALID_MESSAGE_DATA', 44])
    expect(socketWrapper.socket.lastSendMessage).to.equal(msg('R|E|INVALID_MESSAGE_DATA|44+'))
  })

  it('adds a listener with an invalid regexp', () => {
    const socketWrapper = new SocketWrapper(new SocketMock(), options)
    listenerRegistry.handle(socketWrapper, {
      topic: 'R',
      action: 'L',
      data: ['us(']
    })
    expect(options.logger.lastLogArguments).to.deep.equal([3, 'INVALID_MESSAGE_DATA', 'SyntaxError: Invalid regular expression: /us(/: Unterminated group'])
    expect(socketWrapper.socket.lastSendMessage).to.equal(msg('R|E|INVALID_MESSAGE_DATA|SyntaxError: Invalid regular expression: /us(/: Unterminated group+'))
  })
})
*/

describe('listener-registry-local-load-balancing', () => {
    beforeEach(() => {
        tu = new ListenerTestUtils()
    })

    afterEach(() => {
        tu.complete()
    })

    describe('with a single provider', () => {
        it('accepts a subscription', () => {
            // 1.  provider does listen a/.*
            tu.providerListensTo(1, 'a/.*')
            // 3.  provider will get a SP
            tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
            // 2.  clients 1 request a/1
            tu.clientSubscribesTo(1, 'a/1', true)
            // 4.  provider responds with ACCEPT
            tu.publishUpdateWillBeSentToSubscribers('a/1', true)
            tu.providerAccepts(1, 'a/.*', 'a/1')
            // // 6.  clients 2 request a/1
            tu.clientWillRecievePublishedUpdate(2, 'a/1', true)
            tu.clientSubscribesTo(2, 'a/1')
            // // 6.  clients 3 request a/1
            tu.clientWillRecievePublishedUpdate(3, 'a/1', true)
            tu.clientSubscribesTo(3, 'a/1')
            // // 9.  client 1 discards a/1
            tu.clientUnsubscribesTo(3, 'a/1')
            // // 9.  client 2 discards a/1
            tu.clientUnsubscribesTo(2, 'a/1')
            // // 10.  clients discards a/1
            tu.providerWillGetSubscriptionRemoved(1, 'a/.*', 'a/1')
            tu.publishUpdateWillBeSentToSubscribers('a/1', false)
            tu.clientUnsubscribesTo(1, 'a/1', true)
            // // 13.  a/1 should have no active provider
            tu.subscriptionHasActiveProvider('a/1', false)
            // // 14. recieving unknown accept/reject throws an error
            tu.acceptMessageThrowsError(1, 'a/.*', 'a/1')
            tu.rejectMessageThrowsError(1, 'a/.*', 'a/1')
        })

        it('rejects a subscription', () => {
            // 1.  provider does listen a/.*
            tu.providerListensTo(1, 'a/.*')
            // 2.  clients request a/1
            tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
            tu.clientSubscribesTo(1, 'a/1', true)
            // 4.  provider responds with ACCEPT
            tu.providerRejects(1, 'a/.*', 'a/1')
            // 5.  clients discards a/1
            tu.clientUnsubscribesTo(1, 'a/1', true)
            // mocks do expecations to ensure nothing else was called
        })

        it('rejects a subscription with a pattern for which subscriptions already exists', () => {
            // 0. subscription already made for b/1
            tu.subscriptionAlreadyMadeFor('b/1')
            // 1. provider does listen a/.*
            tu.providerWillGetSubscriptionFound(1, 'b/.*', 'b/1')
            tu.providerListensTo(1, 'b/.*')
            // 3. provider responds with REJECT
            tu.providerRejects(1, 'b/.*', 'b/1')
            // 4. clients discards b/1
            tu.clientUnsubscribesTo(1, 'b/1', true)
            // mocks do expecations to ensure nothing else was called
        })

        it('accepts a subscription with a pattern for which subscriptions already exists', () => {
            // 0. subscription already made for b/1
            tu.subscriptionAlreadyMadeFor('b/1')
            // 1. provider does listen a/.*
            tu.providerWillGetSubscriptionFound(1, 'b/.*', 'b/1')
            tu.providerListensTo(1, 'b/.*')
            // 3. provider responds with ACCEPT
            tu.publishUpdateWillBeSentToSubscribers('b/1', true)
            tu.providerAccepts(1, 'b/.*', 'b/1')
            // 5. clients discards b/1
            tu.providerWillGetSubscriptionRemoved(1, 'b/.*', 'b/1')
            tu.publishUpdateWillBeSentToSubscribers('b/1', false)
            tu.clientUnsubscribesTo(1, 'b/1', true)
            // 7. send publishing=false to the clients
        })

        it('accepts a subscription for 2 clients', () => {
            // 1. provider does listen a/.*
            tu.providerListensTo(1, 'a/.*')
            // 2.  client 1 requests a/1
            tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
            tu.clientSubscribesTo(1, 'a/1', true)
            // 4. provider responds with ACCEPT
            tu.publishUpdateWillBeSentToSubscribers('a/1', true)
            tu.providerAccepts(1, 'a/.*', 'a/1')
            // 5. send publishing=true to the clients
            tu.clientWillRecievePublishedUpdate(2, 'a/1', true)
            tu.clientSubscribesTo(2, 'a/1')
            // 9.  client 1 discards a/1
            tu.clientUnsubscribesTo(1, 'a/1')
            // 11.  client 2 discards a/1
            tu.providerWillGetSubscriptionRemoved(1, 'a/.*', 'a/1')
            tu.publishUpdateWillBeSentToSubscribers('a/1', false)
            tu.clientUnsubscribesTo(2, 'a/1', true)
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
            tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
            tu.clientSubscribesTo(1, 'a/1', true)
            // 5. provider 1 responds with REJECTS
            tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')
            tu.providerRejects(1, 'a/.*', 'a/1')
            // 7. provider 2 responds with ACCEPTS
            tu.publishUpdateWillBeSentToSubscribers('a/1', true)
            tu.providerAccepts(2, 'a/[0-9]', 'a/1')
            // 8. send publishing=true to the clients
            // 9. provider 3 does listen a/[0-9]
            tu.providerListensTo(3, 'a/[0-9]')
            // 11. client 1 unsubscribed to a/1
            tu.providerWillGetSubscriptionRemoved(2, 'a/[0-9]', 'a/1')
            tu.publishUpdateWillBeSentToSubscribers('a/1', false)
            tu.clientUnsubscribesTo(1, 'a/1', true)
        })

        it('first accepts, seconds does nothing', () => {
            // 1. provider 1 does listen a/.*
            tu.providerListensTo(1, 'a/.*')
            // 2. provider 2 does listen a/[0-9]
            tu.providerListensTo(2, 'a/[0-9]')
            // 3.  client 1 requests a/1
            tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
            tu.clientSubscribesTo(1, 'a/1', true)
            // 6. provider 1 accepts
            tu.publishUpdateWillBeSentToSubscribers('a/1', true)
            tu.providerAccepts(1, 'a/.*', 'a/1')
            // 12. send publishing=true to the clients
            // 6. client 1 unsubscribed to a/1
            tu.providerWillGetSubscriptionRemoved(1, 'a/.*', 'a/1')
            tu.publishUpdateWillBeSentToSubscribers('a/1', false)
            tu.clientUnsubscribesTo(1, 'a/1', true)
        })

        it('first rejects, seconds - which start listening after first gets SP - accepts', () => {
            // 1. provider 1 does listen a/.*
            tu.providerListensTo(1, 'a/.*')
            // 3.  client 1 requests a/1
            tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
            tu.clientSubscribesTo(1, 'a/1', true)
            // 2. provider 2 does listen a/[0-9]
            tu.providerListensTo(2, 'a/[0-9]')
            // 6. provider 1 rejects
            tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')
            tu.providerRejects(1, 'a/.*', 'a/1')
            // 6. provider 1 accepts
            tu.publishUpdateWillBeSentToSubscribers('a/1', true)
            tu.providerAccepts(2, 'a/[0-9]', 'a/1')
            // 12. send publishing=false to the clients
        })

        it('no messages after unlisten', () => {
            // 1. provider 1 does listen a/.*
            tu.providerListensTo(1, 'a/.*')
            // 2. provider 2 does listen a/[0-9]
            tu.providerListensTo(2, 'a/[0-9]')
            // 3.  client 1 requests a/1
            tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
            tu.clientSubscribesTo(1, 'a/1', true)
            // 2. provider 2 does unlisten a/[0-9]
            tu.providerUnlistensTo(2, 'a/[0-9]')
            // 6. provider 1 responds with REJECTS
            tu.providerRejects(1, 'a/.*', 'a/1')
            // mock does remaining expecations
        })

        it.skip('provider 1 accepts a subscription and disconnects then provider 2 gets a SP', () => {
            // 1. provider 1 does listen a/.*
            tu.providerListensTo(1, 'a/.*')
            // 2. provider 2 does listen a/[0-9]
            tu.providerListensTo(2, 'a/[0-9]')
            // 3.  client 1 requests a/1
            tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
            tu.clientSubscribesTo(1, 'a/1', true)
            // 5. provider 1 responds with ACCEPT
            tu.providerAccepts(1, 'a/.*', 'a/1')
            // 13. subscription has active provider
            tu.subscriptionHasActiveProvider('a/1', true)
            // 7.  client 1 requests a/1
            tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')
            tu.publishUpdateWillBeSentToSubscribers('a/1', false)
            tu.providerLosesItsConnection(1)
            // 8. send publishing=true to the clients
            // 9. subscription doesnt have active provider
            tu.subscriptionHasActiveProvider('a/1', false)
            tu.publishUpdateWillBeSentToSubscribers('a/1', true)
            tu.providerAccepts(2, 'a/[0-9]', 'a/1')
            // 12. send publishing=true to the clients
            // 13. subscription has active provider
            tu.subscriptionHasActiveProvider('a/1', true)
        })
    })
})

describe('listener-registry-local-load-balancing does not send publishing updates for events', () => {
    beforeEach(() => {
        tu = new ListenerTestUtils(C.TOPIC.EVENT)
    })

    afterEach(() => {
        tu.complete()
    })

    it('client with provider already registered', () => {
        // 1. provider does listen a/.*
        tu.providerListensTo(1, 'a/.*')
        // 2.  client 1 requests a/1
        tu.providerWillGetSubscriptionFound(1, 'a/.*', 'a/1')
        tu.clientSubscribesTo(1, 'a/1', true)
        // 4. provider responds with ACCEPT
        tu.providerAccepts(1, 'a/.*', 'a/1')
        // 6. client 2 requests a/1
        tu.clientSubscribesTo(2, 'a/1')
        // 9.  client 1 discards a/1
        tu.clientUnsubscribesTo(1, 'a/1')
        // 11.  client 2 discards a/1
        tu.providerWillGetSubscriptionRemoved(1, 'a/.*', 'a/1')
        tu.clientUnsubscribesTo(2, 'a/1', true)
        // 12. provider should get a SR
        // 13. a/1 should have no active provider
        tu.subscriptionHasActiveProvider('a/1', false)
    })
})

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
        tu.providerWillGetListenTimeout(1, 'a/1')

        setTimeout(() => {
            tu.providerAccepts(1, 'a/[0-9]', 'a/1')
            tu.subscriptionHasActiveProvider('a/1', true)
            done()
        }, 40)
    })

    it.skip('provider 1 times out and gets a RESPONSE_TIMEOUT, but will be ignored because provider 2 accepts as well', (done) => {
        tu.providerWillGetSubscriptionRemoved(1, 'a/.*', 'a/1')
        tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')
        tu.providerWillGetListenTimeout(1, 'a/1')

        setTimeout(() => {
            tu.providerAcceptsButIsntAcknowledged(1, 'a/.*', 'a/1')

            tu.publishUpdateWillBeSentToSubscribers('a/1', true)
            tu.providerAccepts(2, 'a/[0-9]', 'a/1')

            tu.subscriptionHasActiveProvider('a/1', true)
            done()
        }, 40)
    })

    it.skip('provider 1 times out, but then it accept and will be used because provider 2 rejects', (done) => {
        tu.providerWillGetSubscriptionFound(2, 'a/[0-9]', 'a/1')
        tu.providerWillGetListenTimeout(1, 'a/1')

        setTimeout(() => {
            tu.providerAcceptsButIsntAcknowledged(1, 'a/.*', 'a/1')
            tu.subscriptionHasActiveProvider('a/1', false)

            tu.publishUpdateWillBeSentToSubscribers('a/1', true)
            tu.providerRejectsAndPreviousTimeoutProviderThatAcceptedIsUsed(2, 'a/[0-9]', 'a/1')
            tu.subscriptionHasActiveProvider('a/1', true)
            done()
        }, 40)
    })

    it.skip('provider 1 and 2 times out and 3 rejects, 1 rejects and 2 accepts later and 2 wins', (done) => {
        tu.providerWillGetListenTimeout(1, 'a/1')
        tu.providerWillGetListenTimeout(2, 'a/1')

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

    it.skip('1 rejects and 2 accepts later and dies and 3 wins', (done) => {
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

    it.skip('provider 1 and 2 times out and 3 rejects, 1 and 2 accepts later and 1 wins', (done) => {
        tu.providerWillGetListenTimeout(1, 'a/1')
        tu.providerWillGetListenTimeout(2, 'a/1')

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
})
