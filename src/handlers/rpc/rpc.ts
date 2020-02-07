import { RPC_ACTION, TOPIC, RPCMessage, Message } from '../../constants'
import RpcHandler from './rpc-handler'
import { SimpleSocketWrapper, DeepstreamConfig } from '@deepstream/types'

/**
 * Relays a remote procedure call from a requestor to a provider and routes
 * the providers response to the requestor. Provider might either be a locally
 * connected SocketWrapper or a RpcProviderProxy that forwards messages
 * from a remote provider within the network
 */
export class Rpc {
  private message: Message
  private correlationId: string
  private rpcName: string
  private isAccepted: boolean = false
  private acceptTimeout: any
  private responseTimeout: any

  /**
  */
  constructor (private rpcHandler: RpcHandler, private requestor: SimpleSocketWrapper, private provider: SimpleSocketWrapper, private config: DeepstreamConfig, message: RPCMessage) {
    this.rpcName = message.name
    this.correlationId = message.correlationId
    this.message = { ...message, ...this.getRequestor(requestor) }

    this.setProvider(provider)
  }

  private getRequestor (requestor: SimpleSocketWrapper): any {
    const provideAll = this.config.rpc.provideRequestorName && this.config.rpc.provideRequestorData
    switch (true) {
      case provideAll:
        return {
          requestorName: requestor.userId,
          requestorData: requestor.clientData
        }
      case this.config.rpc.provideRequestorName:
        return { requestorName: requestor.userId }
      case this.config.rpc.provideRequestorData:
        return { requestorData: requestor.clientData }
      default:
        return {}
    }
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

    if (message.action === RPC_ACTION.ACCEPT) {
      this.handleAccept(message)
      return
    }

    if (message.action === RPC_ACTION.REJECT || message.action === RPC_ACTION.NO_RPC_PROVIDER) {
      this.reroute()
      return
    }

    if (message.action === RPC_ACTION.RESPONSE || message.action === RPC_ACTION.REQUEST_ERROR) {
      this.requestor.sendMessage(message)
      this.destroy()
    }
  }

  /**
  * Destroys this Rpc, either because its completed or because a timeout has occured
  */
  public destroy (): void {
    clearTimeout(this.acceptTimeout)
    clearTimeout(this.responseTimeout)
    this.rpcHandler.onRPCDestroyed(this.correlationId)
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
    clearTimeout(this.acceptTimeout)
    clearTimeout(this.responseTimeout)

    this.provider = provider
    this.acceptTimeout = setTimeout(this.onAcceptTimeout.bind(this), this.config.rpc.ackTimeout)
    this.responseTimeout = setTimeout(this.onResponseTimeout.bind(this), this.config.rpc.responseTimeout)
    this.provider.sendMessage(this.message)
  }

  /**
  * Handles rpc acknowledgement messages from the provider.
  * If more than one Ack is received an error will be returned
  * to the provider
  */
  private handleAccept (message: RPCMessage) {
    if (this.isAccepted === true) {
      this.provider.sendMessage({
        topic: TOPIC.RPC,
        action: RPC_ACTION.MULTIPLE_ACCEPT,
        name: this.message.name,
        correlationId: this.message.correlationId
      })
      return
    }

    clearTimeout(this.acceptTimeout)
    this.isAccepted = true
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
      return
    }

    this.requestor.sendMessage({
      topic: TOPIC.RPC,
      action: RPC_ACTION.NO_RPC_PROVIDER,
      name: this.message.name,
      correlationId: this.message.correlationId
    })
    this.destroy()
  }

  /**
  * Callback if the accept message hasn't been returned
  * in time by the provider
  */
  private onAcceptTimeout (): void {
    this.requestor.sendMessage({
      topic: TOPIC.RPC,
      action: RPC_ACTION.ACCEPT_TIMEOUT,
      name: this.message.name,
      correlationId: this.message.correlationId
    })
    this.destroy()
  }

  /**
  * Callback if the response message hasn't been returned
  * in time by the provider
  */
  public onResponseTimeout (): void {
    this.requestor.sendMessage({
      topic: TOPIC.RPC,
      action: RPC_ACTION.RESPONSE_TIMEOUT,
      name: this.message.name,
      correlationId: this.message.correlationId
    })
    this.destroy()
  }
}
