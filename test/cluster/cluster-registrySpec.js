/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const ClusterRegistry = require('../../src/cluster/cluster-registry')
const C = require('../../src/constants/constants')
const MessageConnectorMock = require('../mocks/message-connector-mock')
const connectionEndpointMock = {
  getConnectionCount() { return 8 },
}
const EventEmitter = require('events').EventEmitter

let realProcess
let emitter

describe('cluster registry adds and removes names', () => {
  let clusterRegistry

  const addSpy = jasmine.createSpy('add')
  const removeSpy = jasmine.createSpy('remove')

  const options = {
    serverName: 'server-name-a',
    externalUrl: 'some-host:1234',
    clusterKeepAliveInterval: 20,
    clusterActiveCheckInterval: 50,
    clusterNodeInactiveTimeout: 100,
    messageConnector: new MessageConnectorMock(),
    logger: { log: jasmine.createSpy('log') }
  }

  it('sends an exist message when the cluster registry is created', () => {
    clusterRegistry = new ClusterRegistry(options, connectionEndpointMock)
    clusterRegistry.on('add', addSpy)
    clusterRegistry.on('remove', addSpy)
    const msg = options.messageConnector.lastPublishedMessage
    const mem = msg.data[0].memory
    expect(msg.topic).toBe(C.TOPIC.CLUSTER)
    expect(msg.action).toBe(C.ACTIONS.STATUS)
    expect(msg.data[0].serverName).toBe('server-name-a')
    expect(msg.data[0].externalUrl).toBe('some-host:1234')
    expect(msg.data[0].connections).toBe(8)
    expect(isNaN(mem) === false && mem > 0 && mem < 1).toBe(true)
    expect(options.logger.log).toHaveBeenCalledWith(1, 'CLUSTER_JOIN', 'server-name-a')
  })

  it('continuously sends status messages', (done) => {
    let count = 0
    let memory = 0
    const int = setInterval(() => {
      expect(options.messageConnector.lastPublishedMessage.data[0].memory).not.toBe(memory)
      expect(options.messageConnector.lastPublishedMessage.data[0].serverName).toBe('server-name-a')
      count++
      memory = options.messageConnector.lastPublishedMessage.data[0].memory
      options.messageConnector.reset()
      if (count > 3) {
        clearInterval(int)
        done()
      }
    }, 30)
  })

  it('receives a message that adds a node', () => {
    expect(clusterRegistry.getAll()).toEqual(['server-name-a'])

    options.messageConnector.simulateIncomingMessage({
      topic: C.TOPIC.CLUSTER,
      action: C.ACTIONS.STATUS,
      data: [{
        serverName: 'server-name-b',
        websocketConnections: 14,
        memory: 0.3,
        externalUrl: 'external-url-b'
      }]
    })
    expect(options.logger.log).toHaveBeenCalledWith(1, 'CLUSTER_JOIN', 'server-name-b')
    expect(addSpy).toHaveBeenCalledWith('server-name-b')
    expect(clusterRegistry.getAll()).toEqual(['server-name-a', 'server-name-b'])
  })

  it('receives another message that adds a node', () => {
    options.messageConnector.simulateIncomingMessage({
      topic: C.TOPIC.CLUSTER,
      action: C.ACTIONS.STATUS,
      data: [{
        serverName: 'server-name-c',
        websocketConnections: 11,
        memory: 0.9,
        externalUrl: 'external-url-c'
      }]
    })

    expect(options.logger.log).toHaveBeenCalledWith(1, 'CLUSTER_JOIN', 'server-name-c')
    expect(options.logger.log.calls.count()).toBe(3)
    expect(addSpy).toHaveBeenCalledWith('server-name-c')
    expect(clusterRegistry.getAll()).toEqual(['server-name-a', 'server-name-b', 'server-name-c'])
  })

  it('receives a message without data', () => {
    options.messageConnector.simulateIncomingMessage({
      topic: C.TOPIC.CLUSTER,
      action: C.ACTIONS.STATUS,
      data: []
    })
    expect(options.logger.log).toHaveBeenCalledWith(2, 'INVALID_MESSAGE_DATA', [])
  })

  it('receives a message with an unknown action', () => {
    options.messageConnector.simulateIncomingMessage({
      topic: C.TOPIC.CLUSTER,
      action: 'does not exist',
      data: ['bla']
    })

    expect(options.logger.log).toHaveBeenCalledWith(2, 'UNKNOWN_ACTION', 'does not exist')
  })

  it('returns the least utilized node', () => {
    expect(clusterRegistry.getLeastUtilizedExternalUrl()).toBe('external-url-b')
  })

  it('receives an update that changes a status for an existing node', () => {
    options.messageConnector.simulateIncomingMessage({
      topic: C.TOPIC.CLUSTER,
      action: C.ACTIONS.STATUS,
      data: [{
        serverName: 'server-name-c',
        websocketConnections: 11,
        memory: 0.01,
        externalUrl: 'external-url-c'
      }]
    })
    expect(clusterRegistry.getLeastUtilizedExternalUrl()).toBe('external-url-c')
  })

  it('removes a node due to a leave message', () => {
    options.messageConnector.simulateIncomingMessage({
      topic: C.TOPIC.CLUSTER,
      action: C.ACTIONS.REMOVE,
      data: ['server-name-c']
    })

    expect(clusterRegistry.getAll()).toEqual(['server-name-a', 'server-name-b'])
    expect(clusterRegistry.getLeastUtilizedExternalUrl()).toBe('external-url-b')
    expect(options.logger.log).toHaveBeenCalledWith(1, 'CLUSTER_LEAVE', 'server-name-c')
  })

  it('removes a node due to timeout', (done) => {
    expect(clusterRegistry.getAll()).toEqual(['server-name-a', 'server-name-b'])

    setTimeout(() => {
      expect(options.logger.log).toHaveBeenCalledWith(1, 'CLUSTER_LEAVE', 'server-name-b')
      expect(clusterRegistry.getAll()).toEqual(['server-name-a'])
      done()
    }, 500)
  })

  let expectedLength
  it('publishes leave message when closing down', () => {
    expectedLength = options.messageConnector.publishedMessages.length + 1

    clusterRegistry.leaveCluster()

    expect(options.messageConnector.lastPublishedMessage).toEqual(
			{ topic: 'CL', action: 'RM', data: ['server-name-a'] }
		)
    expect(options.messageConnector.publishedMessages.length).toBe(expectedLength)
  })

  it('doesn\'t publish leave message when trying to leave twice', () => {
    clusterRegistry.leaveCluster()

    expect(options.messageConnector.publishedMessages.length).toBe(expectedLength)
  })

  xit('sends a remove message when the process ends', () => {
    options.messageConnector.reset()
    process.emit('exit')
    expect(options.messageConnector.lastPublishedMessage).toEqual(({
      topic: C.TOPIC.CLUSTER,
      action: C.ACTIONS.REMOVE,
      data: ['server-name-a']
    }))
  }).pend('W can\'t simulate an exit via the process since it exits tests')
})
