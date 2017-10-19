import { EventEmitter } from 'events'

export default class SocketMock extends EventEmitter {
  public lastSendMessage: any
  public isDisconnected: any
  public sendMessages: any
  public autoClose: any
  public readyState: any
  public ssl: any
  private socket: any
  // tslint:disable-next-line:variable-name
  public _handle: any

  constructor () {
    super()
    this.lastSendMessage = null
    this.isDisconnected = false
    this.sendMessages = []
    this.autoClose = true
    this.readyState = ''
    this.socket = {}
    this.ssl = null
    this._handle = {}
}

public send (message) {
  this.lastSendMessage = message
  this.sendMessages.push(message)
}

public end () {
}

public getMsg (i) {
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
  this.emit('close')
}

public setNoDelay () {
}
}
