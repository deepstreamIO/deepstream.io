'use strict'

const C = require('../constants/constants')
const SubscriptionRegistry = require('../utils/subscription-registry')
const Rpc = require('./rpc')
const RpcProxy = require('./rpc-proxy')
const utils = require('../utils/utils')

module.exports = class RpcHandler {
  /**
  * Handles incoming messages for the RPC Topic.
  *
  * @param {Object} options deepstream options
  */
  constructor (options, subscriptionRegistry, metaData) {
    this._metaData = metaData
    this._options = options
    this._subscriptionRegistry =
      subscriptionRegistry || new SubscriptionRegistry(options, C.TOPIC.RPC)

    this._options.message.subscribe(
      C.TOPIC.RPC_PRIVATE,
      this._onPrivateMessage.bind(this)
    )

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
          C.EVENT.INVALID_RPC_CORRELATION_ID,
          `unexpected state for rpc ${message.data[rpcNameIndex]} with action ${message.action}`
        )
      }
    } else {
      /*
      *  RESPONSE-, ERROR-, REJECT- and ACK messages from the provider are processed
      * by the Rpc class directly
      */
      this._options.logger.warn(C.EVENT.UNKNOWN_ACTION, message.action, this._metaData)

      if (socketWrapper !== C.SOURCE_MESSAGE_CONNECTOR) {
        socketWrapper.sendError(C.TOPIC.RPC, C.EVENT.UNKNOWN_ACTION, `unknown action ${message.action}`)
      }
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
    const rpcData = this._rpcs.get(correlationId)

    const subscribers = Array.from(this._subscriptionRegistry.getLocalSubscribers(rpcName))
    let index = utils.getRandomIntInRange(0, subscribers.length)

    for (let n = 0; n < subscribers.length; ++n) {
      if (!rpcData.providers.has(subscribers[index])) {
        rpcData.providers.add(subscribers[index])
        return subscribers[index]
      }
      index = (index + 1) % subscribers.length
    }

    if (!rpcData.servers) {
      return null
    }

    const servers = this._subscriptionRegistry.getAllRemoteServers(rpcName)
    index = utils.getRandomIntInRange(0, servers.length)
    for (let n = 0; n < servers.length; ++n) {
      if (!rpcData.servers.has(servers[index])) {
        rpcData.servers.add(servers[index])
        return new RpcProxy(this._options, servers[index], this._metaData)
      }
      index = (index + 1) % servers.length
    }

    return null
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
  _makeRpc (socketWrapper, message, source) {
    if (!isValidMessage(2, socketWrapper, message)) {
      return
    }

    const rpcName = message.data[0]
    const correlationId = message.data[1]

    const rpcData = {
      providers: new Set(),
      servers: source !== C.SOURCE_MESSAGE_CONNECTOR ? new Set() : null,
      rpc: null
    }
    this._rpcs.set(correlationId, rpcData)

    const subscribers = Array.from(this._subscriptionRegistry.getLocalSubscribers(rpcName))
    const provider = subscribers[utils.getRandomIntInRange(0, subscribers.length)]

    if (provider) {
      rpcData.providers.add(provider)
      rpcData.rpc = new Rpc(this, socketWrapper, provider, this._options, message)
    } else if (source === C.SOURCE_MESSAGE_CONNECTOR) {
      socketWrapper.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [rpcName, correlationId])
    } else {
      this._makeRemoteRpc(socketWrapper, message)
    }
  }

  /**
  * Callback to remoteProviderRegistry.getProviderProxy()
  *
  * If a remote provider is available this method will route the rpc to it.
  *
  * If no remote provider could be found this class will return a
  * NO_RPC_PROVIDER error to the requestor. The RPC won't continue from
  * thereon
  *
  * @param   {SocketWrapper} requestor
  * @param   {Object} message   RPC Request message
  *
  * @private
  * @returns {void}
  */
  _makeRemoteRpc (requestor, message) {
    const rpcName = message.data[0]
    const correlationId = message.data[1]
    const rpcData = this._rpcs.get(correlationId)

    const servers = this._subscriptionRegistry.getAllRemoteServers(rpcName)
    const server = servers[utils.getRandomIntInRange(0, servers.length)]

    if (server) {
      const rpcProxy = new RpcProxy(this._options, server, this._metaData)
      rpcData.rpc = new Rpc(this, requestor, rpcProxy, this._options, message)
      return
    }

    this._rpcs.delete(correlationId)

    this._options.logger.warn(C.EVENT.NO_RPC_PROVIDER, rpcName, this._metaData)

    if (requestor !== C.SOURCE_MESSAGE_CONNECTOR) {
      requestor.sendError(C.TOPIC.RPC, C.EVENT.NO_RPC_PROVIDER, [rpcName, correlationId])
    }
  }

  /**
  * Callback for messages that are send directly to
  * this deepstream instance.
  *
  * Please note: Private messages are generic, so the RPC
  * specific ones need to be filtered out.
  *
  * @param   {Object} msg
  *
  * @private
  * @returns {void}
  */
  _onPrivateMessage (msg, originServerName) {
    msg.topic = C.TOPIC.RPC

    if (!msg.data || msg.data.length < 2) {
      this._options.logger.warn(C.EVENT.INVALID_MSGBUS_MESSAGE, msg.data, this._metaData)
      return
    }

    if (msg.action === C.ACTIONS.ERROR && msg.data[0] === C.EVENT.NO_RPC_PROVIDER) {
      msg.action = C.ACTIONS.REJECTION
      msg.data = msg.data[1]
    }

    if (msg.action === C.ACTIONS.REQUEST) {
      const proxy = new RpcProxy(this._options, originServerName, this._metaData)
      this._makeRpc(proxy, msg, C.SOURCE_MESSAGE_CONNECTOR)
    } else if ((msg.action === C.ACTIONS.ACK || msg.action === C.ACTIONS.ERROR) && msg.data[2]) {
      const rpc = this._rpcs.get(msg.data[2])
      if (!rpc) {
        this._options.logger.warn(
          C.EVENT.INVALID_RPC_CORRELATION_ID,
          `Message bus response for RPC that may have been destroyed: ${JSON.stringify(msg)}`,
          this._metaData
        )
        return
      }
      rpc.rpc.handle(msg)
    } else if (this._rpcs.get(msg.data[1])) {
      this._rpcs.get(msg.data[1]).rpc.handle(msg)
    } else {
      this._options.logger.warn(C.EVENT.UNSOLICITED_MSGBUS_MESSAGE, msg, this._metaData)
    }
  }

  /**
   * Called by the RPC with correlationId to destroy itself
   * when lifecycle is over.
   *
   * @param  {String} correlationId id of the RPC
   *
   * @private
   * @returns {void}
   */
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
