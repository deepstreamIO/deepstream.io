/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const DistributedStateRegistry = require('../../src/cluster/distributed-state-registry')
const MessageConnectorMock = require('../mocks/message-connector-mock')
const clusterRegistryMock = new (require('../mocks/cluster-registry-mock'))()

describe('distributed-state-registry local', () => {
  describe('adds and removes names', () => {
    let registry

    const options = {
      clusterRegistry: clusterRegistryMock,
      serverName: 'server-name-a',
      stateReconciliationTimeout: 10,
      messageConnector: new MessageConnectorMock()
    }

    it('creates the registry', () => {
      registry = new DistributedStateRegistry('TEST_TOPIC', options)
      expect(typeof registry.add).toBe('function')
    })

    it('adds a new local name', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('add', callback)
      registry.add('test-name-a')

      expect(options.messageConnector.lastPublishedTopic).toBe('TEST_TOPIC')
      expect(options.messageConnector.lastPublishedMessage).toEqual({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_ADD',
        data: ['test-name-a', 'server-name-a', 2467841850]
      })

      expect(callback).toHaveBeenCalledWith('test-name-a')
      expect(registry.getAll()).toEqual(['test-name-a'])
    })

    it('adds another new local name', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('add', callback)
      registry.add('test-name-b')

      expect(options.messageConnector.lastPublishedTopic).toBe('TEST_TOPIC')
      expect(options.messageConnector.lastPublishedMessage).toEqual({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_ADD',
        data: ['test-name-b', 'server-name-a', 4935683701]
      })

      expect(callback).toHaveBeenCalledWith('test-name-b')
      expect(registry.getAll()).toEqual(['test-name-a', 'test-name-b'])
    })

    it('adds an existing local name', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')

      registry.once('add', callback)
      registry.add('test-name-b')

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).not.toHaveBeenCalled()
      expect(registry.getAll()).toEqual(['test-name-a', 'test-name-b'])
    })

    it('adds a new remote name', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('add', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_ADD',
        data: ['test-name-c', 'server-name-b', 2467841852]
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).toHaveBeenCalledWith('test-name-c')
      expect(registry.getAll()).toEqual(['test-name-a', 'test-name-b', 'test-name-c'])
    })

    it('adds another new remote name', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('add', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_ADD',
        data: ['test-name-d', 'server-name-b', 4935683705]
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).toHaveBeenCalledWith('test-name-d')
      expect(registry.getAll()).toEqual(['test-name-a', 'test-name-b', 'test-name-c', 'test-name-d'])
    })

    it('adds an existing remote name', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('add', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_ADD',
        data: ['test-name-c', 'server-name-c', 2467841852]
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).not.toHaveBeenCalled()
      expect(registry.getAll()).toEqual(['test-name-a', 'test-name-b', 'test-name-c', 'test-name-d'])
      expect(registry.has('test-name-a')).toBe(true)
    })

    it('removes a name that exists once locally', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('remove', callback)

      registry.remove('test-name-a')

      expect(options.messageConnector.lastPublishedTopic).toBe('TEST_TOPIC')
      expect(options.messageConnector.lastPublishedMessage).toEqual({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_REMOVE',
        data: ['test-name-a', 'server-name-a', 2467841851]
      })
      expect(callback).toHaveBeenCalledWith('test-name-a')
      expect(registry.getAll()).toEqual(['test-name-b', 'test-name-c', 'test-name-d'])
      expect(registry.has('test-name-a')).toBe(false)
    })

    it('removes a remote name that exists once', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('remove', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_REMOVE',
        data: ['test-name-d', 'server-name-b', 2467841852]
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).toHaveBeenCalledWith('test-name-d')
      expect(registry.getAll()).toEqual(['test-name-b', 'test-name-c'])
    })

    it('doesnt remove a remote name that exists for another node', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('remove', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_REMOVE',
        data: ['test-name-c', 'server-name-b', 0]
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).not.toHaveBeenCalled()
      expect(registry.getAll()).toEqual(['test-name-b', 'test-name-c'])
    })

    it('removes a remote name once the last node is removed', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('remove', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_REMOVE',
        data: ['test-name-c', 'server-name-c', 0]
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).toHaveBeenCalledWith('test-name-c')
      expect(registry.getAll()).toEqual(['test-name-b'])
    })

    it('ensures that no reconciliation messages where pending', (done) => {
      options.messageConnector.reset()
      setTimeout(() => {
        expect(options.messageConnector.lastPublishedTopic).toBe(null)
        expect(options.messageConnector.lastPublishedMessage).toBe(null)
        done()
      }, 50)
    })
  })

  describe('reconciles states', () => {
    let registry

    const options = {
      clusterRegistry: clusterRegistryMock,
      serverName: 'server-name-a',
      stateReconciliationTimeout: 10,
      logger: { log() { console.log(arguments) } },
      messageConnector: new MessageConnectorMock()
    }

    it('creates the registry', () => {
      registry = new DistributedStateRegistry('TEST_TOPIC', options)
      expect(typeof registry.add).toBe('function')
    })

    it('adds a remote name with invalid checksum', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('add', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_ADD',
        data: ['test-name-z', 'server-name-b', 666] // should be 2467841875
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).toHaveBeenCalledWith('test-name-z')
      expect(registry.getAll()).toEqual(['test-name-z'])
    })

    it('adds a remote name with invalid checksum', (done) => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('add', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_ADD',
        data: ['test-name-c', 'server-name-b', 666] // should be 1054
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).toHaveBeenCalledWith('test-name-c')

      setTimeout(() => {
        expect(options.messageConnector.lastPublishedTopic).toBe('TEST_TOPIC')
        expect(options.messageConnector.lastPublishedMessage).toEqual({
          topic: 'TEST_TOPIC',
          action: 'DISTRIBUTED_STATE_REQUEST_FULL_STATE',
          data: ['server-name-b']
        })
        expect(registry.getAll()).toEqual(['test-name-z', 'test-name-c'])

        done()
      }, 30)
    })

    it('receives a full state update', () => {
      options.messageConnector.reset()
      const callback = jasmine.createSpy('callback')
      registry.once('add', callback)

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_FULL_STATE',
        data: ['server-name-b', ['test-name-x', 'test-name-c']]
      })

      expect(options.messageConnector.lastPublishedTopic).toBe(null)
      expect(options.messageConnector.lastPublishedMessage).toBe(null)
      expect(callback).toHaveBeenCalledWith('test-name-x')
      expect(registry.getAll()).toEqual(['test-name-c', 'test-name-x'])
    })
  })

  describe('invalid messages', () => {
    let registry

    const options = {
      clusterRegistry: clusterRegistryMock,
      serverName: 'server-name-a',
      stateReconciliationTimeout: 10,
      logger: { log: jasmine.createSpy('log') },
      messageConnector: new MessageConnectorMock()
    }

    it('creates the registry', () => {
      registry = new DistributedStateRegistry('TEST_TOPIC', options)
      expect(typeof registry.add).toBe('function')
    })

    it('recieves an invalid length', () => {
      options.messageConnector.reset()

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'DISTRIBUTED_STATE_FULL_STATE',
        data: ['server-name-b']
      })

      expect(options.logger.log).toHaveBeenCalledWith(2, 'INVALID_MESSAGE_DATA', ['server-name-b'])
    })

    it('recieves an unknown action', () => {
      options.messageConnector.reset()

      options.messageConnector.simulateIncomingMessage({
        topic: 'TEST_TOPIC',
        action: 'ACTION_X',
        data: []
      })

      expect(options.logger.log).toHaveBeenCalledWith(2, 'UNKNOWN_ACTION', 'ACTION_X')
    })
  })
})
