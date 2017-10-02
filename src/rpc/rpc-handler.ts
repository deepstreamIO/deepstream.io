import { TOPIC, ACTIONS, EVENT } from '../constants'
import SubscriptionRegistry from '../utils/subscription-registry'
import Rpc from './rpc'
import RpcProxy from './rpc-proxy'
import { getRandomIntInRange } from '../utils/utils'

interface RpcData {
  providers: Set<SimpleSocketWrapper>,
  servers: Set<string>,
  rpc: Rpc
}

export default class RpcHandler {
  private metaData: any
  private subscriptionRegistry: SubscriptionRegistry
  private options: any
  private rpcs: Map<string,RpcData>

  /**
  * Handles incoming messages for the RPC Topic.
  *
  * @param {Object} options deepstream options
  */
  constructor (options: any, subscriptionRegistry?: SubscriptionRegistry, metaData?: any) {
     this.metaData = metaData
     this.options = options
     this.subscriptionRegistry =
      subscriptionRegistry || new SubscriptionRegistry(options, TOPIC.RPC)

     this.options.message.subscribe(
      TOPIC.RPC_PRIVATE,
       this.onPrivateMessage.bind(this)
    )

     this.rpcs = new Map()
  }

  /**
  * Main interface. Handles incoming messages
  * from the message distributor
  */
  public handle (socketWrapper: SocketWrapper, message: RPCMessage): void {
    if (message.action === ACTIONS.SUBSCRIBE) {
      this.subscriptionRegistry.subscribe(message, socketWrapper)
    } else if (message.action === ACTIONS.UNSUBSCRIBE) {
      this.subscriptionRegistry.unsubscribe(message, socketWrapper)
    } else if (message.action === ACTIONS.REQUEST && !message.isAck) {
       this.makeRpc(socketWrapper, message, false)
    } else if (
      message.action === ACTIONS.RESPONSE ||
      message.action === ACTIONS.REJECTION ||
      message.isAck ||
      message.isError
    ) {
      const rpcData =  this.rpcs.get(message.correlationId)
      if (rpcData) {
        rpcData.rpc.handle(message)
      } else {
        socketWrapper.sendError(
          message,
          EVENT.INVALID_RPC_CORRELATION_ID
        )
      }
    } else {
      /*
      *  RESPONSE-, ERROR-, REJECT- and ACK messages from the provider are processed
      * by the Rpc class directly
      */
       this.options.logger.warn(EVENT.UNKNOWN_ACTION, message.action, this.metaData)
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
  */
  public getAlternativeProvider (rpcName: string, correlationId: string): SimpleSocketWrapper {
    const rpcData =  this.rpcs.get(correlationId)
    const subscribers = Array.from( this.subscriptionRegistry.getLocalSubscribers(rpcName))
    let index = getRandomIntInRange(0, subscribers.length)

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

    const servers =  this.subscriptionRegistry.getAllRemoteServers(rpcName)
    index = getRandomIntInRange(0, servers.length)
    for (let n = 0; n < servers.length; ++n) {
      if (!rpcData.servers.has(servers[index])) {
        rpcData.servers.add(servers[index])
        return new RpcProxy(this.options, servers[index], this.metaData)
      }
      index = (index + 1) % servers.length
    }

    return null
  }

  /**
  * Executes a RPC. If there are clients connected to
  * this deepstream instance that can provide the rpc, it
  * will be routed to a random one of them, otherwise it will be routed
  * to the message connector
  */
  private makeRpc (socketWrapper: SimpleSocketWrapper, message: RPCMessage, isRemote: boolean): void {
    const rpcName = message.name
    const correlationId = message.correlationId

    const rpcData = {
      providers: new Set(),
      servers: !isRemote ? new Set() : null,
      rpc: null
    } as RpcData
    this.rpcs.set(correlationId, rpcData)

    const subscribers = Array.from( this.subscriptionRegistry.getLocalSubscribers(rpcName))
    const provider = subscribers[getRandomIntInRange(0, subscribers.length)]

    if (provider) {
      rpcData.providers.add(provider)
      rpcData.rpc = new Rpc(this, socketWrapper, provider,  this.options, message)
    } else if (isRemote) {
      socketWrapper.sendError(TOPIC.RPC, EVENT.NO_RPC_PROVIDER, [rpcName, correlationId])
    } else {
       this.makeRemoteRpc(socketWrapper, message)
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
  */
  public makeRemoteRpc (requestor: SimpleSocketWrapper, message: RPCMessage): void {
    const rpcName = message.name
    const correlationId = message.correlationId
    const rpcData =  this.rpcs.get(correlationId)

    const servers =  this.subscriptionRegistry.getAllRemoteServers(rpcName)
    const server = servers[getRandomIntInRange(0, servers.length)]

    if (server) {
      const rpcProxy = new RpcProxy(this.options, server, this.metaData)
      rpcData.rpc = new Rpc(this, requestor, rpcProxy, this.options, message)
      return
    }

     this.rpcs.delete(correlationId)

     this.options.logger.warn(EVENT.NO_RPC_PROVIDER, rpcName, this.metaData)

    if (!requestor.isRemote) {
      requestor.sendError(message, EVENT.NO_RPC_PROVIDER)
    }
  }

  /**
  * Callback for messages that are send directly to
  * this deepstream instance.
  *
  * Please note: Private messages are generic, so the RPC
  * specific ones need to be filtered out.
  */
  private onPrivateMessage (msg: RPCMessage, originServerName: string): void {
    msg.topic = TOPIC.RPC

    if (!msg.data || msg.data.length < 2) {
       this.options.logger.warn(EVENT.INVALID_MSGBUS_MESSAGE, msg.data,  this.metaData)
      return
    }

    if (msg.action === ACTIONS.ERROR && msg.data[0] === EVENT.NO_RPC_PROVIDER) {
      msg.action = ACTIONS.REJECTION
      msg.data = msg.data[1]
    }

    if (msg.action === ACTIONS.REQUEST) {
      const proxy = new RpcProxy(this.options, originServerName, this.metaData)
       this.makeRpc(proxy, msg, true)
    } else if ((msg.isAck || msg.isError) && msg.correlationId) {
      const rpc =  this.rpcs.get(msg.correlationId)
      if (!rpc) {
         this.options.logger.warn(
          EVENT.INVALID_RPC_CORRELATION_ID,
          `Message bus response for RPC that may have been destroyed: ${JSON.stringify(msg)}`,
           this.metaData
        )
        return
      }
      rpc.rpc.handle(msg)
    } else if ( this.rpcs.get(msg.data[1])) {
       this.rpcs.get(msg.data[1]).rpc.handle(msg)
    } else {
       this.options.logger.warn(EVENT.UNSOLICITED_MSGBUS_MESSAGE, msg,  this.metaData)
    }
  }

  /**
   * Called by the RPC with correlationId to destroy itself
   * when lifecycle is over.
   */
  public _$onDestroy (correlationId: string): void {
     this.rpcs.delete(correlationId)
  }
}
