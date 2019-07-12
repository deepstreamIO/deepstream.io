import { Message } from '../../constants'

export default class SocketMock {
  public lastSendMessage: any
  public isDisconnected: any
  public sendMessages: any
  public autoClose: any
  public readyState: any
  public ssl: any
  // tslint:disable-next-line:variable-name
  public _handle: any

  constructor () {
    this.lastSendMessage = null
    this.isDisconnected = false
    this.sendMessages = []
    this.autoClose = true
    this.readyState = ''
    this.ssl = null
    this._handle = {}
}

public send (message: Message) {
  this.lastSendMessage = message
  this.sendMessages.push(message)
}

public end () {
}

public getMsg (i: number) {
  return this.sendMessages[this.sendMessages.length - (i + 1)]
}

public getMsgSize () {
  return this.sendMessages.length
}

public close () {
  if (this.autoClose === true) {
    this.doClose()
  }
}

public destroy () {
  this.doClose()
}

public doClose () {
  this.isDisconnected = true
  this.readyState = 'closed'
}

}
