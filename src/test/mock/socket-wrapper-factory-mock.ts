import { EventEmitter } from 'events'
import { Message } from '../../constants'

class SocketWrapperMock extends EventEmitter {
  public static lastPreparedMessage: any
  public isClosed: boolean = false
  public authCallBack: any = null
  public authAttempts: number = 0
  public uuid: number = Math.random()
  public lastSendMessage: any

  public userId: any = null
  public serverData: any

  constructor (private handshakeData: any) {
    super()
  }

  public sendAckMessage (message: Message) {
    this.lastSendMessage = message
  }

  public getHandshakeData () {
    return this.handshakeData
  }

  public sendError (/* topic, type, msg */) {
  }

  public sendMessage (message: Message) {
    this.lastSendMessage = message
  }

  public parseData (message: Message) {
    if (message.parsedData || !message.data) {
      return null
    }
    try {
      message.parsedData = JSON.parse(message.data.toString())
      return true
    } catch (e) {
      return e
    }
  }

  public send (/* message */) {
  }

  public destroy () {
    this.authCallBack = null
    this.isClosed = true
    this.emit('close', this)
  }

  public close () {
    this.destroy()
  }

  public setUpHandshakeData () {
    this.handshakeData = {
      remoteAddress: 'remote@address'
    }

    return this.handshakeData
  }
}

export const createSocketWrapper = (options?: any) => new SocketWrapperMock(options)
