import { TOPIC, ACTIONS, EVENT } from '../constants'
import { EventEmitter } from 'events'
/**
 * This class exposes an interface that mimicks the behaviour
 * of a SocketWrapper, connected to a local rpc provider, but
 * infact relays calls from and to the message connector - sneaky.
 */
export default class RpcProxy extends EventEmitter implements SimpleSocketWrapper {
  private options: any
  private remoteServer: string
  private metaData: any
  public type: string
  public isRemote: boolean

  /**
  */
  constructor (options: DeepstreamOptions, remoteServer: string, metaData: any) {
    super()
    this.isRemote = true
    this.metaData = metaData
    this.options = options
    this.remoteServer = remoteServer
  }

  public sendAckMessage (message: Message): void {

  }

  /**
  * Mimicks the SocketWrapper's send method, but expects a message object,
  * instead of a string.
  *
  * Adds additional information to the message that enables the counterparty
  * to identify the sender
  */
  public sendMessage (message: Message): void {
    if (message.isAck && message.action !== ACTIONS.REQUEST) {
      message.isCompleted = true
    }
    this.options.message.sendDirect(
      this.remoteServer, TOPIC.RPC_PRIVATE, message, this.metaData
    )
  }

  /**
  * Mimicks the SocketWrapper's sendError method.
  * Sends an error on the specified topic. The
  * action will automatically be set to ACTION.ERROR
  */
  public sendError (topic: string, type: string, msg: Message): void {
    if (type === EVENT.RESPONSE_TIMEOUT) {
      // by the time an RPC has timed out on this server, it has already timed out on the remote
      // (and has been cleaned up) so no point sending
      return
    }
    this.options.message.sendDirect(this.remoteServer, TOPIC.RPC_PRIVATE, {
      topic: TOPIC.RPC_PRIVATE,
      action: ACTIONS.ERROR,
      data: [type, msg]
    }, this.metaData)
  }
}
