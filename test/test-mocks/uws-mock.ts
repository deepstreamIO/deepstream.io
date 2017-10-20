export class Group {
  public root: any

  constructor (root) {
    this.root = root
  }

  public startAutoPing (group, interval, message) {
    this.root.heartbeatInterval = interval
    this.root.pingMessage = message
  }
  public create () {
    return {}
  }
  public onConnection (group, connectionHandler) {
    this.root._connectionHandler = connectionHandler
  }
  public onDisconnection (group, disconnectionHandler) {

  }
  public onMessage (group, messageHandler) {
    this.root.messageHandler = messageHandler
  }
  public onPing (group, pingHandler) {

  }
  public onPong (group, pongHandler) {

  }
  public broadcast () {

  }
  public close () {

  }
}

// tslint:disable-next-line:max-classes-per-file
export class Server {
  public root: any
  public group: any
  constructor (root) {
    this.root = root
    this.group = new Group(root)
  }

  public send () {
  }
}

// tslint:disable-next-line:max-classes-per-file
export class Native {
  public root: any
  public server: any

  constructor (root) {
    this.root = root
    this.server = new Server(root)
    this.root._lastUserData = null
  }

  public setUserData (external, userData) {
    this.root._lastUserData = userData
  }

  public clearUserData () {

  }

  public getAddress () {
    return [null, '127.0.0.1', null]
  }

  public transfer () {
    this.root.close()
  }

  public upgrade () {
    const external = {}
    this.root._connectionHandler(external)
  }
}

let i = 0
let uwsMock: any = null
import { EventEmitter } from 'events'

// tslint:disable-next-line:max-classes-per-file
export class UWSMock extends EventEmitter {
  public clients: any
  public clientsCount: any
  public heartbeatInterval: any
  public pingMessage: any
  private connectionHandler: any
  public messageHandler: any
  public native: any
  public lastUserData: any

  constructor () {
    super()
    this.clients = {}
    this.clientsCount = 0
    this.heartbeatInterval = null
    this.pingMessage = null
    this.connectionHandler = null
    this.messageHandler = null
    this.setMaxListeners(0)
    uwsMock = this
    this.native = new Native(this)
  }

  public simulateConnection () {
    const socketMock = this.lastUserData

    const clientIndex = i++
    socketMock.once('close', this._onClose.bind(this, clientIndex))
    this.clients[clientIndex] = socketMock
    this.clientsCount++

    return socketMock
  }

  public _onClose (clientIndex) {
    delete this.clients[clientIndex]
    this.clientsCount--
  }

  public close () {
  }
}

export default new UWSMock()
