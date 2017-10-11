import { RPC_ACTIONS, PRESENCE_ACTIONS, TOPIC, EVENT } from '../constants'
import { EventEmitter } from 'events'

/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky.
 */
export default class RpcProxy extends EventEmitter implements SimpleSocketWrapper {
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private remoteServer: string
  private metaData: any
  public type: string
  public isRemote: boolean

  /**
  */
  constructor (config: DeepstreamConfig, services: DeepstreamServices, remoteServer: string, metaData: any) {
    super()
    this.isRemote = true
    this.metaData = metaData
    this.config = config
    this.services = services
    this.remoteServer = remoteServer
  }

  public sendAckMessage (message: RPCMessage): void {
  }

  /**
  * Mimicks the SocketWrapper's send method, but expects a message object,
  * instead of a string.
  *
  * Adds additional information to the message that enables the counterparty
  * to identify the sender
  */
  public sendMessage (msg: RPCMessage): void {
    this.services.message.sendDirect(this.remoteServer, msg, this.metaData)
  }

  /**
  * Mimicks the SocketWrapper's sendError method.
  * Sends an error on the specified topic. The
  * action will automatically be set to ACTION.ERROR
  */
  public sendError (msg: RPCMessage, type: EVENT, errorMessage: string): void {
    if (type === EVENT.RESPONSE_TIMEOUT) {
      // by the time an RPC has timed out on this server, it has already timed out on the remote
      // (and has been cleaned up) so no point sending
      return
    }
    this.services.message.sendDirect(this.remoteServer, msg, this.metaData)
  }
}
