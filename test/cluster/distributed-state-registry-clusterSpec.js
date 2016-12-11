/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const DistributedStateRegistry = require('../../src/cluster/distributed-state-registry')
const LocalMessageConnector = require('../mocks/local-message-connector')
const clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))()

const createRegistry = function (serverName, messageConnector) {
  const options = {
    clusterRegistry: clusterRegistryMock,
    serverName,
    stateReconciliationTimeout: 10,
    messageConnector
  }
  const result = {
    options,
    addCallback: jasmine.createSpy('add'),
    removeCallback: jasmine.createSpy('remove'),
    registry: new DistributedStateRegistry('TEST_TOPIC', options)
  }

  result.registry.on('add', result.addCallback)
  result.registry.on('remove', result.removeCallback)

  return result
}

describe('distributed-state-registry cluster', () => {
  describe('adds and removes names', () => {
    const messageConnector = new LocalMessageConnector()
    let registryA
    let registryB
    let registryC

    it('creates the registries', () => {
      registryA = createRegistry('server-name-a', messageConnector)
      registryB = createRegistry('server-name-b', messageConnector)
      registryC = createRegistry('server-name-c', messageConnector)
      expect(messageConnector.subscribedTopics.length).toBe(3)
    })

    it('adds an entry to registry a', () => {
      registryA.registry.add('test-entry-a')
      expect(registryA.addCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryB.addCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryC.addCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryA.registry.getAll()).toEqual(['test-entry-a'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-a'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-a'])
    })

    it('adds an entry to registry b', () => {
      registryB.registry.add('test-entry-b')
      expect(registryA.addCallback).toHaveBeenCalledWith('test-entry-b')
      expect(registryB.addCallback).toHaveBeenCalledWith('test-entry-b')
      expect(registryC.addCallback).toHaveBeenCalledWith('test-entry-b')
      expect(registryA.registry.getAll()).toEqual(['test-entry-a', 'test-entry-b'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-a', 'test-entry-b'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-a', 'test-entry-b'])
    })

    it('adds the same entry to registry c', () => {
      registryA.addCallback.calls.reset()
      registryB.addCallback.calls.reset()
      registryC.addCallback.calls.reset()
      registryC.registry.add('test-entry-b')
      expect(registryA.addCallback).not.toHaveBeenCalled()
      expect(registryB.addCallback).not.toHaveBeenCalled()
      expect(registryC.addCallback).not.toHaveBeenCalled()
      expect(registryA.registry.getAll()).toEqual(['test-entry-a', 'test-entry-b'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-a', 'test-entry-b'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-a', 'test-entry-b'])
    })

    it('removes a single node entry from registry a', () => {
      registryA.registry.remove('test-entry-a')
      expect(registryA.removeCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryB.removeCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryC.removeCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryA.registry.getAll()).toEqual(['test-entry-b'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-b'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-b'])
    })

    it('removes a multi node entry from registry b', () => {
      registryA.removeCallback.calls.reset()
      registryB.removeCallback.calls.reset()
      registryC.removeCallback.calls.reset()
      registryB.registry.remove('test-entry-b')
      expect(registryA.removeCallback).not.toHaveBeenCalled()
      expect(registryB.removeCallback).not.toHaveBeenCalled()
      expect(registryC.removeCallback).not.toHaveBeenCalled()
      expect(registryA.registry.getAll()).toEqual(['test-entry-b'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-b'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-b'])
    })

    it('removes a multi node entry from registry c', () => {
      registryA.removeCallback.calls.reset()
      registryB.removeCallback.calls.reset()
      registryC.removeCallback.calls.reset()
      registryC.registry.remove('test-entry-b')
      expect(registryA.removeCallback).toHaveBeenCalledWith('test-entry-b')
      expect(registryB.removeCallback).toHaveBeenCalledWith('test-entry-b')
      expect(registryC.removeCallback).toHaveBeenCalledWith('test-entry-b')
      expect(registryA.registry.getAll()).toEqual([])
      expect(registryB.registry.getAll()).toEqual([])
      expect(registryC.registry.getAll()).toEqual([])
    })

    it('gets all servernames with a subscription', () => {
      registryA.removeCallback.calls.reset()
      registryB.removeCallback.calls.reset()
      registryC.removeCallback.calls.reset()

      registryB.registry.add('test-entry-same')
      registryC.registry.add('test-entry-same')

      expect(registryA.registry.getAllServers('test-entry-same')).toEqual(['server-name-b', 'server-name-c'])

      registryB.registry.remove('test-entry-same')
      registryC.registry.remove('test-entry-same')

      expect(registryA.registry.getAllServers('test-entry-same')).toEqual([])
    })

    it('removes an entire server', () => {
      registryA.removeCallback.calls.reset()
      registryB.removeCallback.calls.reset()
      registryC.removeCallback.calls.reset()

      registryB.registry.add('test-entry-b-1')
      registryB.registry.add('test-entry-b-2')
      registryC.registry.add('test-entry-c')

      expect(registryA.registry.getAll()).toEqual(['test-entry-b-1', 'test-entry-b-2', 'test-entry-c'])

      registryA.options.clusterRegistry.emit('remove', 'server-name-b')

      expect(registryA.registry.getAll()).toEqual(['test-entry-c'])
    })
  })

  describe('reconciles state', () => {
    const messageConnector = new LocalMessageConnector()
    let registryA
    let registryB
    let registryC

    it('creates the registries', () => {
      registryA = createRegistry('server-name-a', messageConnector)
      registryB = createRegistry('server-name-b', messageConnector)
      registryC = createRegistry('server-name-c', messageConnector)
      expect(messageConnector.subscribedTopics.length).toBe(3)
    })

    it('adds an entry to registry a', () => {
      registryA.registry.add('test-entry-a')
      expect(registryA.addCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryB.addCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryC.addCallback).toHaveBeenCalledWith('test-entry-a')
      expect(registryA.registry.getAll()).toEqual(['test-entry-a'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-a'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-a'])
    })

    it('adds an entry to registry b, but drops the message resulting in a compromised state', () => {
      registryA.addCallback.calls.reset()
      registryB.addCallback.calls.reset()
      registryC.addCallback.calls.reset()
      messageConnector.dropNextMessage = true
      registryB.registry.add('test-entry-f')
      expect(registryA.addCallback).not.toHaveBeenCalled()
      expect(registryB.addCallback).toHaveBeenCalledWith('test-entry-f')
      expect(registryC.addCallback).not.toHaveBeenCalled()
      expect(registryA.registry.getAll()).toEqual(['test-entry-a'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-a', 'test-entry-f'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-a'])
    })

    it('adds another entry to registry b, the other registries detect the compromised state', (done) => {
      registryA.addCallback.calls.reset()
      registryB.addCallback.calls.reset()
      registryC.addCallback.calls.reset()
      registryB.registry.add('test-entry-g')
      expect(messageConnector.messages.length).toBe(11)
      expect(registryA.addCallback).toHaveBeenCalledWith('test-entry-g')
      expect(registryB.addCallback).toHaveBeenCalledWith('test-entry-g')
      expect(registryC.addCallback).toHaveBeenCalledWith('test-entry-g')
      expect(registryA.registry.getAll()).toEqual(['test-entry-a', 'test-entry-g'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-a', 'test-entry-f', 'test-entry-g'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-a', 'test-entry-g'])
      setTimeout(done, 50)
    })

    it('has reconciled the compromised state', () => {
      expect(messageConnector.messages.length).toBe(14)

			// registry A asks for state
      expect(messageConnector.messages[0].data.action).toBe('DISTRIBUTED_STATE_REQUEST_FULL_STATE')
      expect(messageConnector.messages[1].data.action).toBe('DISTRIBUTED_STATE_FULL_STATE')

			// registry B asks for state
      expect(messageConnector.messages[2].data.action).toBe('DISTRIBUTED_STATE_REQUEST_FULL_STATE')
      expect(messageConnector.messages[3].data.action).toBe('DISTRIBUTED_STATE_FULL_STATE')
      expect(messageConnector.messages[4].data.action).toBe('DISTRIBUTED_STATE_FULL_STATE')

			// registry C asks for state
      expect(messageConnector.messages[5].data.action).toBe('DISTRIBUTED_STATE_REQUEST_FULL_STATE')
      expect(messageConnector.messages[6].data.action).toBe('DISTRIBUTED_STATE_FULL_STATE')
      expect(messageConnector.messages[7].data.action).toBe('DISTRIBUTED_STATE_FULL_STATE')
      expect(messageConnector.messages[8].data.action).toBe('DISTRIBUTED_STATE_FULL_STATE')

			// add 'test-entry-a'
      expect(messageConnector.messages[9].data.action).toBe('DISTRIBUTED_STATE_ADD')
			// add 'test-entry-g', 'test-entry-f' has been dropped
      expect(messageConnector.messages[10].data.action).toBe('DISTRIBUTED_STATE_ADD')
			// full state request from either A or C arrives
      expect(messageConnector.messages[11].data.action).toBe('DISTRIBUTED_STATE_REQUEST_FULL_STATE')
			// B response immediatly with full state
      expect(messageConnector.messages[12].data.action).toBe('DISTRIBUTED_STATE_FULL_STATE')
			// full state request from the other registry (either A or C) arrives, but is ignored as fulls state has already
			// been send within stateReconciliationTimeout
      expect(messageConnector.messages[13].data.action).toBe('DISTRIBUTED_STATE_REQUEST_FULL_STATE')

      expect(registryA.addCallback).toHaveBeenCalledWith('test-entry-f')
      expect(registryC.addCallback).toHaveBeenCalledWith('test-entry-f')
      expect(registryA.registry.getAll()).toEqual(['test-entry-a', 'test-entry-g', 'test-entry-f'])
      expect(registryB.registry.getAll()).toEqual(['test-entry-a', 'test-entry-f', 'test-entry-g'])
      expect(registryC.registry.getAll()).toEqual(['test-entry-a', 'test-entry-g', 'test-entry-f'])
    })
  })
})
