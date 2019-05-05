import { RPC_ACTIONS, RPCMessage } from '../constants'

/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky.
 */
export default class RpcProxy implements SimpleSocketWrapper {
  public isRemote = true
  public type: string
  public user: string

  /**
  */
  // @ts-ignore
  constructor (config: InternalDeepstreamConfig, private services: DeepstreamServices, private remoteServer: string, private  metaData: any) {
    // used for logging
    this.user = 'remote server ' + remoteServer
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
  public sendError (msg: RPCMessage, type: RPC_ACTIONS, errorMessage: string): void {
    if (type === RPC_ACTIONS.RESPONSE_TIMEOUT) {
      // by the time an RPC has timed out on this server, it has already timed out on the remote
      // (and has been cleaned up) so no point sending
      return
    }
    this.services.message.sendDirect(this.remoteServer, msg, this.metaData)
  }
}
