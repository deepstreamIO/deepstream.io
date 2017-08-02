'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')

module.exports = class RpcHandler {
  constructor (options) {
    this._options = options
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RPC)
    this._rpcs = new Map()
  }

  handle (socket, message) {
    const [ name, id, data ] = message.data

    if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._subscriptionRegistry.subscribe(name, socket)
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(name, socket)
    } else if (message.action === C.ACTIONS.REQUEST) {
      this._rpcs.set(id, {
        id,
        name,
        socket,
        data,
        providers: new Set(),
        timeout: null
      })

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

      if (message.action === C.ACTIONS.RESPONSE || message.action === C.ACTIONS.ERROR) {
        if (message.raw) {
          rpc.socket.sendNative(message.raw)
        } else {
          rpc.socket.sendMessage(message.topic, message.action, message.data)
        }
        this._rpcs.delete(id)
      } else if (message.action === C.ACTIONS.REJECTION) {
        this._request(rpc)
      }
    } else {
      socket.sendError(C.TOPIC.RPC, C.EVENT.UNKNOWN_ACTION, `unknown action ${message.action}`)
    }
  }

  _request (rpc) {
    const subscribers = Array
      .from(this._subscriptionRegistry.getSubscribers(rpc.name))
      .filter(x => !rpc.providers.has(x))

    const provider = subscribers[Math.floor(Math.random() * subscribers.length)]

    if (provider) {
      provider.sendMessage(C.TOPIC.RPC, C.ACTIONS.REQUEST, [ rpc.name, rpc.id, rpc.data ])
      rpc.providers.add(provider)
      rpc.timeout = setTimeout(() => this._request(rpc), this._options.rpcTimeout)
    } else {
      rpc.socket.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [ rpc.name, rpc.id ])
      this._rpcs.delete(rpc.id)
    }
  }
}
