'use strict'

const testHelper = require('../test-helper/test-helper')
const RpcProxy = require('../../src/rpc/rpc-proxy')
const C = require('../../src/constants')

const options = testHelper.getDeepstreamOptions()
const config = options.config
const services = options.services

xdescribe('rpcProxy proxies calls from and to the remote receiver', () => {
  let rpcProxy

  beforeEach(() => {
    rpcProxy = new RpcProxy(config, services, 'serverNameA')
  })

  it('manipulates the message before sending', () => {
    rpcProxy.send({
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.ACK,
      name: 'a',
      correlationId: 1234
    })

    expect(options.message.lastDirectSentMessage).toEqual({
      serverName: 'serverNameA',
      topic: 'PRIVATE/P',
      message: {
        topic: C.TOPIC.RPC,
        action: C.ACTIONS.ACK,
        name: 'a',
        correlationId: 1234
      }
    })
  })

  it('adds a isCompleted flag after sending the message', () => {
    const msg = {
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.RESPONSE,
      data: ['a', 'b']
    }

    rpcProxy.send(msg)
    expect(msg.isCompleted).toBe(true)
  })
})
