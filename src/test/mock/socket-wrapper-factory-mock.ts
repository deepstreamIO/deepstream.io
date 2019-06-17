import { EventEmitter } from 'events'
import { Message } from '../../constants'

const SocketWrapperMock = class extends EventEmitter {
  public static lastPreparedMessage: any
  public isClosed: any
  public user: any
  public authCallBack: any
  public authAttempts: any
  public uuid: any
  public handshakeData: any
  public lastSendMessage: any

  constructor (options?: any) {
    super()
    this.isClosed = false
    this.user = null
    this.authCallBack = null
    this.authAttempts = 0
    this.uuid = Math.random()
    this.handshakeData = options
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
