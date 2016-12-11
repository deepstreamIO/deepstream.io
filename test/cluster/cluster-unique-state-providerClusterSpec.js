/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ClusterUniqueStateProvider = require('../../src/cluster/cluster-unique-state-provider')
const C = require('../../src/constants/constants')
const LocalMessageConnector = new (require('../mocks/local-message-connector'))()
const ClusterRegistry = require('../../src/cluster/cluster-registry')

function createServer(serverName, clusterScore) {
  const connectionEndpoint = {
    getConnectionCount: () => {}
  }

  const options = {
    serverName,
    messageConnector: LocalMessageConnector,
    logger: { log: jasmine.createSpy('log') },
    lockTimeout: 10,
    lockRequestTimeout: 5
  }

  const result = {}
  result.options = options
  result.clusterRegistry = new ClusterRegistry(options, connectionEndpoint)
  result.clusterRegistry._leaderScore = clusterScore
  result.uniqueStateProvider = new ClusterUniqueStateProvider(options, result.clusterRegistry)
  result.spy = jasmine.createSpy(serverName)

  return result
}

describe('unique state provider handles cluster locks', () => {
  let a,
    b,
    c

  beforeEach((done) => {
    a = createServer('servername-a', 1)
    b = createServer('servername-b', 2)
    c = createServer('servername-c', 3)

		// Done for nodes to find each other out
    setTimeout(done, 50)
  })

  afterEach(() => {
    a.clusterRegistry.leaveCluster()
    b.clusterRegistry.leaveCluster()
    c.clusterRegistry.leaveCluster()
  })

  it('provider A gets a lock, provider B can\'t get one', () => {
    a.uniqueStateProvider.get('a', a.spy)
    b.uniqueStateProvider.get('a', b.spy)

    expect(a.spy).toHaveBeenCalledWith(true)
    expect(b.spy).toHaveBeenCalledWith(false)
  })

  it('provider A gets a lock, releases it, then provider B can get one', () => {
    a.uniqueStateProvider.get('a', a.spy)
    a.uniqueStateProvider.release('a')
    b.uniqueStateProvider.get('a', b.spy)

    expect(a.spy).toHaveBeenCalledWith(true)
    expect(b.spy).toHaveBeenCalledWith(true)
  })

  it('provider A gets a lock and doesn\'t release it in time', (done) => {
    a.uniqueStateProvider.get('a', a.spy)

    setTimeout(() => {
      b.uniqueStateProvider.get('a', b.spy)

      expect(a.spy).toHaveBeenCalledWith(true)
      expect(b.spy).toHaveBeenCalledWith(true)

      done()
    }, a.options.lockTimeout + 10)
  })
})
