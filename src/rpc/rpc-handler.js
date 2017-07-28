'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const Rpc = require('./rpc')
const utils = require('../utils/utils')

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
  * @param   {SocketWrapper} socketWrapper
  * @param   {Object} message parsed and validated deepstream message
  *
  * @public
  * @returns {void}
  */
  handle (socketWrapper, message) {
    if (message.action === C.ACTIONS.SUBSCRIBE) {
      this._registerProvider(socketWrapper, message)
    } else if (message.action === C.ACTIONS.UNSUBSCRIBE) {
      this._unregisterProvider(socketWrapper, message)
    } else if (message.action === C.ACTIONS.REQUEST) {
      this._makeRpc(socketWrapper, message)
    } else if (
      message.action === C.ACTIONS.RESPONSE ||
      message.action === C.ACTIONS.ACK ||
      message.action === C.ACTIONS.REJECTION ||
      message.action === C.ACTIONS.ERROR
    ) {
      const rpcNameIndex = (message.action === C.ACTIONS.ACK || message.action === C.ACTIONS.ERROR)
        ? 1 : 0
      const correlationId = message.data[rpcNameIndex + 1]
      const rpcData = this._rpcs.get(correlationId)
      if (rpcData) {
        rpcData.rpc.handle(message)
      } else {
        socketWrapper.sendError(
          C.TOPIC.RPC,
          C.EVENT.INVALID_MESSAGE_DATA,
          `unexpected state for rpc ${message.data[rpcNameIndex]} with action ${message.action}`
        )
      }
    } else {
      socketWrapper.sendError(C.TOPIC.RPC, C.EVENT.UNKNOWN_ACTION, `unknown action ${message.action}`)
    }
  }

  /**
  * This method is called by Rpc to reroute its request
  *
  * If a provider is temporarily unable to service a request, it can reject it. Deepstream
  * will then try to reroute it to an alternative provider. Finding an alternative provider
  * happens in this method.
  *
  * Initially, deepstream will look for a local provider that hasn't been used by the RPC yet.
  * If non can be found, it will go through the currently avaiblable remote providers and try
  * find one that hasn't been used yet.
  *
  * If a remote provider couldn't be found or all remote-providers have been tried already
  * this method will return null - which in turn will prompt the RPC to send a NO_RPC_PROVIDER
  * error to the client
  *
  * @param {String}  rpcName
  * @param {String}  correlationId
  *
  * @public
  * @returns {SocketWrapper|RpcProxy} alternativeProvider
  */
  getAlternativeProvider (rpcName, correlationId) {
    const { providers } = this._rpcs.get(correlationId)
    const subscribers = Array.from(this._subscriptionRegistry.getSubscribers(rpcName))
    const offset = utils.getRandomIntInRange(0, subscribers.length)

    for (let n = 0; n < subscribers.length; ++n) {
      const subscriber = subscribers[(offset + n) % subscribers.length]

      if (providers.has(subscriber)) {
        continue
      }

      providers.add(subscriber)

      return subscriber
    }
  }

  /**
  * Callback for subscription messages. Registers
  * a client as a provider for specific remote
  * procedure calls as identified by <rpcName>
  *
  * @param   {SocketWrapper} socketWrapper
  * @param   {Object} message parsed and validated deepstream message
  *
  * @private
  * @returns {void}
  */
  _registerProvider (socketWrapper, message) {
    if (isValidMessage(1, socketWrapper, message)) {
      this._subscriptionRegistry.subscribe(message.data[0], socketWrapper)
    }
  }

  /**
  * Callback for unsubscribe messages. Removes
  * a client as a provider for specific remote
  * procedure calls as identified by <rpcName>
  *
  * @param   {SocketWrapper} socketWrapper
  * @param   {Object} message parsed and validated deepstream message
  *
  * @private
  * @returns {void}
  */
  _unregisterProvider (socketWrapper, message) {
    if (isValidMessage(1, socketWrapper, message)) {
      this._subscriptionRegistry.unsubscribe(message.data[0], socketWrapper)
    }
  }

  /**
  * Executes a RPC. If there are clients connected to
  * this deepstream instance that can provide the rpc, it
  * will be routed to a random one of them, otherwise it will be routed
  * to the message connector
  *
  * @param   {SocketWrapper} socketWrapper
  * @param   {Object} message parsed and validated deepstream message
  *
  * @private
  * @returns {void}
  */
  _makeRpc (socketWrapper, message) {
    if (!isValidMessage(2, socketWrapper, message)) {
      return
    }

    const rpcName = message.data[0]
    const correlationId = message.data[1]

    const rpcData = {
      providers: new Set(),
      rpc: null
    }
    this._rpcs.set(correlationId, rpcData)

    const subscribers = Array.from(this._subscriptionRegistry.getSubscribers(rpcName))
    const provider = subscribers[utils.getRandomIntInRange(0, subscribers.length)]

    if (provider) {
      rpcData.providers.add(provider)
      rpcData.rpc = new Rpc(this, socketWrapper, provider, this._options, message)
    } else {
      socketWrapper.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [rpcName, correlationId])
    }
  }

  _$onDestroy (correlationId) {
    this._rpcs.delete(correlationId)
  }
}

/**
* Checks if the incoming message is valid, e.g. if rpcName
* is present for subscribe / unsubscribe messages or if
* rpcName and correlationId is present for rpc calls.
*
* @param   {Number}  dataLength    The expected number of entries in the data array
* @param   {SocketWrapper} socketWrapper
* @param   {Object} message parsed and validated deepstream message
*
* @private
* @returns {Boolean} isValid
*/
function isValidMessage (dataLength, socketWrapper, message) {
  if (message.data && message.data.length >= dataLength && typeof message.data[0] === 'string') {
    return true
  }

  socketWrapper.sendError(C.TOPIC.RPC, C.EVENT.INVALID_MESSAGE_DATA, message.raw)

  return false
}
