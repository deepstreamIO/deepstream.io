/* eslint-disable max-len */
import { TOPIC, EVENT, ACTIONS } from '../constants'
import RpcProxy from './rpc-proxy'
import RpcHandler from './rpc-handler'

/**
 * Relays a remote procedure call from a requestor to a provider and routes
 * the providers response to the requestor. Provider might either be a locally
 * connected SocketWrapper or a RpcProviderProxy that forwards messages
 * from a remote provider within the network
 */
export default class Rpc {
  private rpcHandler: RpcHandler
  private requestor: SimpleSocketWrapper
  private provider: SimpleSocketWrapper
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private message: Message
  private correlationId: string
  private rpcName: string
  private isAcknowledged: boolean
  private ackTimeout: any
  private responseTimeout: any

  /**
  */
  constructor (rpcHandler: RpcHandler, requestor: SimpleSocketWrapper, provider: SimpleSocketWrapper, config: DeepstreamConfig, services: DeepstreamServices,  message: RPCMessage) {
    this.rpcHandler = rpcHandler
    this.rpcName = message.name
    this.correlationId = message.correlationId
    this.requestor = requestor
    this.provider = provider
    this.config = config
    this.services = services
    this.message = message
    this.isAcknowledged = false

    this.setProvider(provider)
  }

  /**
  * Processor for incoming messages from the RPC provider. The
  * RPC provider is expected to send two messages,
  *
  * RPC|A|REQ|<rpcName>|<correlationId>
  *
  * and
  *
  * RPC|RES|<rpcName>|<correlationId|[<data>]
  *
  * Both of these messages will just be forwarded directly
  * to the requestor
  */
  public handle (message: RPCMessage): void {
    if (message.correlationId !== this.correlationId) {
      return
    }

    if (message.isAck) {
      this.handleAck(message)
    } else if (message.action === ACTIONS.REJECTION) {
      this.reroute()
    } else if (message.action === ACTIONS.RESPONSE || message.isError) {
      this.requestor.sendMessage(message)
      this.destroy()
    }
  }

  /**
  * Destroyes this Rpc, either because its completed
  * or because a timeout has occured
  */
  public destroy (): void {
    clearTimeout(this.ackTimeout)
    clearTimeout(this.responseTimeout)
    this.rpcHandler._$onDestroy(this.correlationId)
  }

  /**
  * By default, a RPC is the communication between one requestor
  * and one provider. If the original provider however rejects
  * the request, deepstream will try to re-route it to another provider.
  *
  * This happens in the reroute method. This method will query
  * the rpc-handler for an alternative provider and - if it has
  * found one - call this method to replace the provider and re-do
  * the second leg of the rpc
  */
  private setProvider (provider: SimpleSocketWrapper): void {
    clearTimeout(this.ackTimeout)
    clearTimeout(this.responseTimeout)

    this.provider = provider
    this.ackTimeout = setTimeout(this.onAckTimeout.bind(this), this.config.rpcAckTimeout)
    this.responseTimeout = setTimeout(this.onResponseTimeout.bind(this), this.config.rpcTimeout)
    this.provider.sendMessage(this.message)
  }

  /**
  * Handles rpc acknowledgement messages from the provider.
  * If more than one Ack is received an error will be returned
  * to the provider
  */
  private handleAck (message: RPCMessage) {
    if (this.isAcknowledged === true) {
      this.provider.sendError(this.message, EVENT.MULTIPLE_ACK)
      return
    }

    clearTimeout(this.ackTimeout)
    this.isAcknowledged = true
    this.requestor.sendMessage(message)
  }

  /**
  * This method handles rejection messages from the current provider. If
  * a provider is temporarily unable to serve a request, it can reject it
  * and deepstream will try to reroute to an alternative provider
  *
  * If no alternative provider could be found, this method will send a NO_RPC_PROVIDER
  * error to the client and destroy itself
  */
  public reroute (): void {
    const alternativeProvider = this.rpcHandler.getAlternativeProvider(this.rpcName, this.correlationId)

    if (alternativeProvider) {
      this.setProvider(alternativeProvider)
    } else {
      this.requestor.sendError(this.message, EVENT.NO_RPC_PROVIDER)
      this.destroy()
    }
  }

  /**
  * Callback if the acknowledge message hasn't been returned
  * in time by the provider
  */
  private onAckTimeout (): void {
    this.requestor.sendError(this.message, EVENT.ACK_TIMEOUT)
    this.destroy()
  }

  /**
  * Callback if the response message hasn't been returned
  * in time by the provider
  */
  public onResponseTimeout (): void {
    this.requestor.sendError(this.message, EVENT.RESPONSE_TIMEOUT)
    this.destroy()
  }
}
