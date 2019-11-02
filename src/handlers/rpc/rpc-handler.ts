import { PARSER_ACTION, RPC_ACTION, TOPIC, RPCMessage, BulkSubscriptionMessage, STATE_REGISTRY_TOPIC } from '../../constants'
import { getRandomIntInRange } from '../../utils/utils'
import { Rpc } from './rpc'
import { RpcProxy } from './rpc-proxy'
import { SimpleSocketWrapper, DeepstreamConfig, DeepstreamServices, SocketWrapper, SubscriptionRegistry, Handler } from '@deepstream/types'

interface RpcData {
  providers: Set<SimpleSocketWrapper>,
  servers: Set<string> | null,
  rpc: Rpc
}

export default class RpcHandler extends Handler<RPCMessage> {
  private subscriptionRegistry: SubscriptionRegistry
  private rpcs: Map<string, RpcData> = new Map()

  /**
  * Handles incoming messages for the RPC Topic.
  */
  constructor (private config: DeepstreamConfig, private services: DeepstreamServices, subscriptionRegistry?: SubscriptionRegistry, private metaData?: any) {
    super()

    this.subscriptionRegistry =
      subscriptionRegistry || services.subscriptions.getSubscriptionRegistry(TOPIC.RPC, STATE_REGISTRY_TOPIC.RPC_SUBSCRIPTIONS)

    this.subscriptionRegistry.setAction('NOT_SUBSCRIBED', RPC_ACTION.NOT_PROVIDED)
    this.subscriptionRegistry.setAction('MULTIPLE_SUBSCRIPTIONS', RPC_ACTION.MULTIPLE_PROVIDERS)
    this.subscriptionRegistry.setAction('SUBSCRIBE', RPC_ACTION.PROVIDE)
    this.subscriptionRegistry.setAction('UNSUBSCRIBE', RPC_ACTION.UNPROVIDE)
  }

  /**
  * Main interface. Handles incoming messages
  * from the message distributor
  */
  public handle (socketWrapper: SocketWrapper, message: RPCMessage, originServerName: string): void {
    if (socketWrapper === null) {
      this.onRemoteRPCMessage(message, originServerName)
      return
    }

    if (message.action === RPC_ACTION.REQUEST) {
      this.makeRpc(socketWrapper, message, false)
      return
   }

    if (message.action === RPC_ACTION.PROVIDE) {
      this.subscriptionRegistry.subscribeBulk(message as BulkSubscriptionMessage, socketWrapper)
      return
    }

    if (message.action === RPC_ACTION.UNPROVIDE) {
      this.subscriptionRegistry.unsubscribeBulk(message as BulkSubscriptionMessage, socketWrapper)
      return
    }

    if (
      message.action === RPC_ACTION.RESPONSE ||
      message.action === RPC_ACTION.REJECT ||
      message.action === RPC_ACTION.ACCEPT ||
      message.action === RPC_ACTION.REQUEST_ERROR
    ) {
      const rpcData = this.rpcs.get(message.correlationId)
      if (rpcData) {
        this.services.logger.debug(
          RPC_ACTION[message.action],
          `name: ${message.name} with correlation id: ${message.correlationId} from ${socketWrapper.userId}`,
          this.metaData
        )
        rpcData.rpc.handle(message)
        return
      }
      this.services.logger.warn(
        RPC_ACTION[RPC_ACTION.INVALID_RPC_CORRELATION_ID],
        `name: ${message.name} with correlation id: ${message.correlationId}`,
        this.metaData
      )
      socketWrapper.sendMessage({
        topic: TOPIC.RPC,
        action: RPC_ACTION.INVALID_RPC_CORRELATION_ID,
        originalAction: message.action,
        name: message.name,
        correlationId: message.correlationId,
        isError: true
      })
      return
    }

    /*
    *  RESPONSE-, ERROR-, REJECT- and ACK messages from the provider are processed
    * by the Rpc class directly
    */
    this.services.logger.warn(PARSER_ACTION[PARSER_ACTION.UNKNOWN_ACTION], message.action.toString(), this.metaData)
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
  public getAlternativeProvider (rpcName: string, correlationId: string): SimpleSocketWrapper | null {
    const rpcData =  this.rpcs.get(correlationId)

    if (!rpcData) {
      // log error
      return null
    }

    const subscribers = Array.from(this.subscriptionRegistry.getLocalSubscribers(rpcName))
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

    const servers = this.subscriptionRegistry.getAllRemoteServers(rpcName)

    index = getRandomIntInRange(0, servers.length)
    for (let n = 0; n < servers.length; ++n) {
      if (!rpcData.servers.has(servers[index])) {
        rpcData.servers.add(servers[index])
        return new RpcProxy(this.config, this.services, servers[index], this.metaData)
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

    this.services.logger.debug(
      RPC_ACTION[RPC_ACTION.REQUEST],
      `name: ${rpcName} with correlation id: ${correlationId} from ${socketWrapper.userId}`,
      this.metaData
    )

    const subscribers = Array.from(this.subscriptionRegistry.getLocalSubscribers(rpcName))
    const provider = subscribers[getRandomIntInRange(0, subscribers.length)]

    if (provider) {
      this.rpcs.set(correlationId, {
        providers: new Set([provider]),
        servers: isRemote ? null : new Set(),
        rpc: new Rpc(this, socketWrapper, provider, this.config, message),
      })
      return
    }

    if (isRemote) {
      socketWrapper.sendMessage({
        topic: TOPIC.RPC,
        action: RPC_ACTION.NO_RPC_PROVIDER,
        name: rpcName,
        correlationId
      })
      return
    }

    this.makeRemoteRpc(socketWrapper, message)
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

    const servers = this.subscriptionRegistry.getAllRemoteServers(rpcName)
    const server = servers[getRandomIntInRange(0, servers.length)]

    if (server) {
      const rpcProxy = new RpcProxy(this.config, this.services, server, this.metaData)
      this.rpcs.set(correlationId, {
        providers: new Set(),
        servers: new Set(),
        rpc: new Rpc(this, requestor, rpcProxy, this.config, message),
      })
      return
    }

    this.rpcs.delete(correlationId)

    this.services.logger.warn(
      RPC_ACTION[RPC_ACTION.NO_RPC_PROVIDER],
      `name: ${message.name} with correlation id: ${message.correlationId}`,
      this.metaData
    )

    if (!requestor.isRemote) {
      requestor.sendMessage({
        topic: TOPIC.RPC,
        action: RPC_ACTION.NO_RPC_PROVIDER,
        name: rpcName,
        correlationId
      })
    }
  }

  /**
  * Callback for messages that are send directly to
  * this deepstream instance.
  *
  * Please note: Private messages are generic, so the RPC
  * specific ones need to be filtered out.
  */
  private onRemoteRPCMessage (msg: RPCMessage, originServerName: string): void {
    if (msg.action === RPC_ACTION.REQUEST) {
      const proxy = new RpcProxy(this.config, this.services, originServerName, this.metaData)
      this.makeRpc(proxy, msg, true)
      return
    }

    const rpcData = this.rpcs.get(msg.correlationId)

    if (!rpcData) {
      this.services.logger.warn(
        RPC_ACTION[RPC_ACTION.INVALID_RPC_CORRELATION_ID],
        `Message bus response for RPC that may have been destroyed: ${JSON.stringify(msg)}`,
        this.metaData,
      )
      return
    }

    this.services.logger.debug(
      RPC_ACTION[msg.action],
      `name: ${msg.name} with correlation id: ${msg.correlationId} from remote server ${originServerName}`,
      this.metaData
    )

    rpcData.rpc.handle(msg)
  }

  /**
   * Called by the RPC with correlationId to destroy itself
   * when lifecycle is over.
   */
  public onRPCDestroyed (correlationId: string): void {
     this.rpcs.delete(correlationId)
  }
}
