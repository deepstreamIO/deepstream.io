const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const toFastProperties = require('to-fast-properties')

module.exports = class RpcHandler {
  constructor (options) {
    this._options = options
    this._rpcs = new Map()
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RPC)
    this._pool = []
  }

  handle (socket, message) {
    if (!message.data || !message.data[0]) {
      socket.sendError(C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, [ undefined, message.raw ])
      return
    }

    const [ name, id, data ] = message.data

    if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._subscriptionRegistry.subscribe(name, socket)
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(name, socket)
    } else if (message.action === C.ACTIONS.REQUEST) {
      let rpc = this._pool.pop()

      if (rpc) {
        rpc.id = id
        rpc.name = name
        rpc.socket = socket
        rpc.data = data
      } else {
        rpc = toFastProperties({
          id,
          name,
          socket,
          data,
          history: new Set(),
          provider: null,
          timeout: null
        })
      }

      rpc.request = this._request.bind(this, rpc)
      this._rpcs.set(id, rpc)

      this._request(rpc)
    } else if (
      message.action === C.ACTIONS.RESPONSE ||
      message.action === C.ACTIONS.REJECTION
    ) {
      const rpc = this._rpcs.get(id)

      if (!rpc) {
        socket.sendError(C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, `unexpected state for rpc ${name} with action ${message.action}`)
        return
      }

      if (rpc.timeout) {
        clearTimeout(rpc.timeout)
        rpc.timeout = null
      }

      if (rpc.provider) {
        rpc.provider.removeListener('close', rpc.request)
        rpc.provider = null
      }

      if (message.action === C.ACTIONS.RESPONSE) {
        rpc.socket.sendNative(message.raw)
        this._destroy(rpc)
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
    if (rpc.timeout) {
      clearTimeout(rpc.timeout)
      rpc.timeout = null
    }

    const providers = Array
      .from(this._subscriptionRegistry.getSubscribers(rpc.name))
      .filter(provider => !rpc.history.has(provider))

    const provider = providers[Math.floor(Math.random() * providers.length)]

    if (provider) {
      provider.sendMessage(C.TOPIC.RPC, C.ACTIONS.REQUEST, [ rpc.name, rpc.id, rpc.data ])
      rpc.history.add(provider)
      rpc.timeout = setTimeout(rpc.request, this._options.rpcTimeout || 1000)
      rpc.provider = provider
      rpc.provider.once('close', rpc.request)
    } else {
      rpc.socket.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [ rpc.name, rpc.id ])
      this._destroy(rpc)
    }
  }

  _destroy (rpc) {
    this._rpcs.delete(rpc.id)
    rpc.id = null
    rpc.name = null
    rpc.socket = null
    rpc.data = null
    rpc.history.clear()
    rpc.provider = null
    rpc.timeout = null
    this._pool.push(rpc)
  }
}
