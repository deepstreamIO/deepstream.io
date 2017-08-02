'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')

module.exports = class RpcHandler {
  /**
  * Handles incoming messages for the RPC Topic.
  *
  * @param {Object} options deepstream options
  */
  constructor (options) {
    this._options = options
    this._subscriptionRegistry = new SubscriptionRegistry(options, C.TOPIC.RPC)
    this._rpcs = new Map()
  }

  /**
  * Main interface. Handles incoming messages
  * from the message distributor
  *
  * @param   {SocketWrapper} socket
  * @param   {Object} message parsed and validated deepstream message
  *
  * @public
  * @returns {void}
  */
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
      const [ name, id ] = message
      const rpc = this._rpcs.get(id)

      if (!rpc) {
        socket.sendError(
          C.TOPIC.RPC,
          C.EVENT.INVALID_MESSAGE_DATA,
          `unexpected state for rpc ${name} with action ${message.action}`
        )
        return
      }

      if (message.action === C.ACTIONS.RESPONSE || message.action === C.ACTIONS.ERROR) {
        rpc.socket.sendNative(message.topic, message.action, message.data)
        clearTimeout(rpc.timeout)
        this._rpcs.delete(id)
      } else if (message.action === C.ACTIONS.REJECTION) {
        this._request(rpc)
      }
    } else {
      socket.sendError(C.TOPIC.RPC, C.EVENT.UNKNOWN_ACTION, `unknown action ${message.action}`)
    }
  }

  _request (rpc) {
    const { name, socket, providers } = rpc

    const subscribers = Array
      .from(this._subscriptionRegistry.getSubscribers(name))
      .filter(x => !providers.has(x))

    const provider = subscribers[Math.floor(Math.random() * subscribers.length)]

    if (provider) {
      provider.sendNative(C.TOPIC.RPC, C.ACTIONS.REQUEST, [ name, rpc.id, rpc.data ])
      providers.add(provider)
      rpc.timeout = setTimeout(() => this._request(rpc), this._options.rpcTimeout)
    } else {
      socket.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [ name, rpc.id ])
    }
  }
}
