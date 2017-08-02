'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')

module.exports = class RpcHandler {
  constructor (options) {
    this._options = options
    this._rpcs = new Map()
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RPC)

    this._onSocketClose = this._onSocketClose.bind(this)
  }

  _onSocketClose (socket) {
    for (const [ id, rpc ] of this._rpcs) {
      if (rpc.provider !== socket) {
        continue
      }
      clearTimeout(rpc.timeout)
      this._request(id)
    }
  }

  handle (socket, message) {
    const [ name, id, data ] = message.data

    if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._subscriptionRegistry.subscribe(name, socket)
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(name, socket)
    } else if (message.action === C.ACTIONS.REQUEST) {
      const rpc = {
        id,
        name,
        socket,
        data,
        providers: new Set(),
        provider: null,
        request: this._request.bind(this, rpc),
        timeout: null
      }
      this._rpcs.set(id, rpc)

      this._request(id)
    } else if (
      message.action === C.ACTIONS.RESPONSE ||
      message.action === C.ACTIONS.REJECTION ||
      message.action === C.ACTIONS.ERROR
    ) {
      const rpc = this._rpcs.get(id)

      if (!rpc) {
        socket.sendError(C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, `unexpected state for rpc ${name} with action ${message.action}`)
        return
      }

      clearTimeout(rpc.timeout)
      rpc.timeout = null

      rpc.provider.removeListener('close', rpc.request)
      rpc.provider = null

      if (message.action === C.ACTIONS.RESPONSE || message.action === C.ACTIONS.ERROR) {
        if (message.raw) {
          rpc.socket.sendNative(message.raw)
        } else {
          rpc.socket.sendMessage(message.topic, message.action, message.data)
        }
        this._rpcs.delete(id)
      } else if (message.action === C.ACTIONS.REJECTION && rpc.provider === socket) {
        this._request(rpc)
      }
    } else {
      socket.sendError(C.TOPIC.RECORD, C.EVENT.UNKNOWN_ACTION, [
        ...(message ? message.data : []),
        `unknown action ${message.action}`
      ])
    }
  }

  _request (rpc) {
    const subscribers = Array
      .from(this._subscriptionRegistry.getSubscribers(rpc.name))
      .filter(x => !rpc.providers.has(x))

    if (rpc.timeout) {
      clearTimeout(rpc.timeout)
      rpc.timeout = null
    }

    const provider = subscribers[Math.floor(Math.random() * subscribers.length)]

    if (provider) {
      provider.sendMessage(C.TOPIC.RPC, C.ACTIONS.REQUEST, [ rpc.name, rpc.id, rpc.data ])
      rpc.timeout = setTimeout(rpc.request, this._options.rpcTimeout || 1000)
      rpc.provider = provider
      rpc.provider.once('close', rpc.request)
    } else {
      rpc.socket.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [ rpc.name, rpc.id ])
      this._rpcs.delete(rpc.id)
    }
  }
}
