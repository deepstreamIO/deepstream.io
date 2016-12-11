/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ClusterRegistry = require('../../src/cluster/cluster-registry')
const C = require('../../src/constants/constants')
const LocalMessageConnector = require('../mocks/local-message-connector')
const messageConnector = new LocalMessageConnector()
const connectionEndpointMock = {
  getConnectionCount() { return 8 }
}

describe('distributed-state-registry adds and removes names', () => {
  const createClusterRegistry = function (serverName, externalUrl) {
    const options = {
      serverName,
      externalUrl,
      clusterKeepAliveInterval: 20,
      clusterActiveCheckInterval: 50,
      clusterNodeInactiveTimeout: 100,
      messageConnector,
      logger: { log: jasmine.createSpy('log') }
    }

    const result = {
      clusterRegistry: new ClusterRegistry(options, connectionEndpointMock),
      addSpy: jasmine.createSpy('add'),
      removeSpy: jasmine.createSpy('remove')
    }

    result.clusterRegistry.on('add', result.addSpy)
    result.clusterRegistry.on('remove', result.removeSpy)

    return result
  }

  let a,
    b,
    c

  it('creates three registries', (done) => {
    a = createClusterRegistry('server-name-a', 'external-url-a')
    b = createClusterRegistry('server-name-b', 'external-url-b')
    c = createClusterRegistry('server-name-c', 'external-url-c')

    expect(a.clusterRegistry.getAll()).toEqual(['server-name-a', 'server-name-b', 'server-name-c'])
    expect(b.clusterRegistry.getAll()).toEqual(['server-name-b', 'server-name-c'])
    expect(c.clusterRegistry.getAll()).toEqual(['server-name-c'])

    setTimeout(done, 100)
  })

  it('synced all clusters', () => {
    expect(a.clusterRegistry.getAll().sort()).toEqual(['server-name-a', 'server-name-b', 'server-name-c'])
    expect(b.clusterRegistry.getAll().sort()).toEqual(['server-name-a', 'server-name-b', 'server-name-c'])
    expect(c.clusterRegistry.getAll().sort()).toEqual(['server-name-a', 'server-name-b', 'server-name-c'])
  })

  it('removes a node', () => {
    a.clusterRegistry.leaveCluster()
    expect(b.clusterRegistry.getAll().sort()).toEqual(['server-name-b', 'server-name-c'])
    expect(c.clusterRegistry.getAll().sort()).toEqual(['server-name-b', 'server-name-c'])
  })
})
