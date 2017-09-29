const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const toFastProperties = require('to-fast-properties')
const messageBuilder = require(`../message/message-builder`)

module.exports = class RpcHandler {
  constructor (options) {
    this._options = options
    this._rpcs = new Map()
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RPC)
  }

  handle (socket, rawMessage) {
    const [ , action, name, id, data ] = rawMessage.split(C.MESSAGE_PART_SEPERATOR, 5)

    if (action === C.ACTIONS.SUBSCRIBE) {
      this._subscriptionRegistry.subscribe(name, socket)
    } else if (action === C.ACTIONS.UNSUBSCRIBE) {
      this._subscriptionRegistry.unsubscribe(name, socket)
    } else if (action === C.ACTIONS.REQUEST) {
      const rpc = toFastProperties({
        id,
        name,
        socket,
        data,
        history: new Set(),
        provider: null,
        timeout: null
      })

      rpc.request = this._request.bind(this, rpc)
      this._rpcs.set(id, rpc)

      this._request(rpc)
    } else if (
      action === C.ACTIONS.RESPONSE ||
      action === C.ACTIONS.REJECTION
    ) {
      const rpc = this._rpcs.get(id)

      if (!rpc) {
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

      if (action === C.ACTIONS.RESPONSE) {
        rpc.socket.sendNative(rawMessage)
        this._rpcs.delete(rpc.id)
      } else if (action === C.ACTIONS.REJECTION) {
        if (rpc.provider === socket) {
          this._request(rpc)
        } else {
          rpc.socket.sendError(C.TOPIC.RPC, C.EVENT.RPC_TIMEOUT, [ rpc.name, rpc.id ])
        }
      }
    } else {
      socket.sendError(null, C.EVENT.UNKNOWN_ACTION, rawMessage)
    }
  }

  _request (rpc) {
    if (rpc.timeout) {
      clearTimeout(rpc.timeout)
      rpc.timeout = null
    }

    const providers = Array
      .from(this._subscriptionRegistry.getSubscribers(rpc.name))
      .filter(provider => !rpc.history.has(provider.id))

    const provider = providers[Math.floor(Math.random() * providers.length)]

    if (provider) {
      provider.sendNative(messageBuilder.buildMsg5(
        C.TOPIC.RPC,
        C.ACTIONS.REQUEST,
        rpc.name,
        rpc.id,
        rpc.data
      ))
      rpc.history.add(provider.id)
      rpc.timeout = setTimeout(rpc.request, this._options.rpcTimeout || 1000)
      rpc.provider = provider
      rpc.provider.once('close', rpc.request)
    } else {
      rpc.socket.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [ rpc.name, rpc.id ])
      this._rpcs.delete(rpc.id)
    }
  }
}
