/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ListenerTestUtils = require('./listener-test-utils')

let tu

describe('listener-registry-remote-load-balancing', () => {
  beforeEach(() => {
    tu = new ListenerTestUtils()
  })

  describe('when a listen leader', () => {
    it('asks other nodes to publish', () => {
      // 1.  provider does listen a/.*
      tu.providerListensTo(1, 'a/.*')
      // 2.  remote provider does listen a/.*
      tu.remoteProviderListensTo('server-b', 'a/.*')
      // 2.  remote provider does listen a/.*
      tu.remoteProviderListensTo('server-c', 'a/[0-9]')
      // 2.  clients 1 request a/1
      tu.clientSubscribesTo(1, 'a/1')
      // 2.  provider requests lock
      tu.lockRequested('R_LISTEN_LOCK_a/1')
      // 3.  local provider gets a SP
      tu.providerGetsSubscriptionFound(1, 'a/.*', 'a/1')
      // 4.  local provider rejects
      tu.providerRejects(1, 'a/.*', 'a/1')
      // 5.  remote deepstream is asked
      tu.remoteProviderNotifiedToStartDiscovery('server-b', 'a/1')
      // 5.  remote deepstream provides ack
      tu.remoteProviderRespondsWithAck('server-b', 'a/1')
      // 5.  remote deepstream is asked
      tu.remoteProviderNotifiedToStartDiscovery('server-c', 'a/1')
      // 6.   remote published match added
      tu.remoteActiveProvidedRecordRecieved('server-c', 'a/1')
      // notify has providers
    }).pend('ListenerTestUtils doesn\'t implement methods')
  })
})
