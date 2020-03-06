import { RPC_ACTION, RPCMessage, ParseResult } from '../../constants'
import { SimpleSocketWrapper, DeepstreamConfig, DeepstreamServices } from '@deepstream/types'

/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky.
 */
export class RpcProxy implements SimpleSocketWrapper {
  public socketType = 'RpcProxy'
  public userId: string = 'remote server ' + this.remoteServer
  public clientData = null
  public serverData = null
  public isRemote = true

  constructor (config: DeepstreamConfig, private services: DeepstreamServices, private remoteServer: string, private  metaData: any) {
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
    this.services.clusterNode.sendDirect(this.remoteServer, msg, this.metaData)
  }

  /**
  * Mimicks the SocketWrapper's sendError method.
  * Sends an error on the specified topic. The
  * action will automatically be set to ACTION.ERROR
  */
  public sendError (msg: RPCMessage, type: RPC_ACTION, errorMessage: string): void {
    if (type === RPC_ACTION.RESPONSE_TIMEOUT) {
      // by the time an RPC has timed out on this server, it has already timed out on the remote
      // (and has been cleaned up) so no point sending
      return
    }
    this.services.clusterNode.sendDirect(this.remoteServer, msg, this.metaData)
  }

  public parseMessage (serializedMessage: any): ParseResult[] {
    throw new Error('Method not implemented.')
  }
}
