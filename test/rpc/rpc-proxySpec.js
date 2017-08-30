/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

const testHelper = require('../test-helper/test-helper')
const RpcProxy = require('../../src/rpc/rpc-proxy')
const C = require('../../src/constants/constants')

const options = testHelper.getDeepstreamOptions()

describe('rpcProxy proxies calls from and to the remote receiver', () => {
  let rpcProxy

  it('creates the proxy', () => {
    expect(options.message.lastSubscribedTopic).toBe(null)
    rpcProxy = new RpcProxy(options, 'serverNameA')
  })

  it('manipulates the message before sending', () => {
    rpcProxy.send({
      topic: C.TOPIC.RPC,
      action: C.ACTIONS.ACK,
      data: ['a', 'b']
    })

    expect(options.message.lastDirectSentMessage).toEqual({
      serverName: 'serverNameA',
      topic: 'PRIVATE/P',
      message: {
        topic: C.TOPIC.RPC,
        action: C.ACTIONS.ACK,
        data: ['a', 'b']
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
