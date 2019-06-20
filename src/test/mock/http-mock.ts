import { EventEmitter } from 'events'

export class HttpServerMock extends EventEmitter {
  public listening: boolean  = false
  public closed: boolean = false
  private port: any
  private host: any

  public listen (port: string, host: string, callback: Function) {
    this.port = port
    this.host = host
    const server = this
    process.nextTick(() => {
      server.listening = true
      server.emit('listening')
      if (callback) {
        callback()
      }
    })
  }

  public close (callback: Function) {
    this.closed = true
    this.emit('close')
    if (callback) {
      callback()
    }
  }

  public address () {
    return {
      address: this.host || 'localhost',
      port: this.port || 8080
    }
  }

  public _simulateUpgrade (socket: any) {
    const head = {}
    const request = {
      url: 'https://deepstream.io/?ds=foo',
      headers: {
        'origin': '',
        'sec-websocket-key': 'xxxxxxxxxxxxxxxxxxxxxxxx'
      },
      connection: {
        authorized: true
      }
    }
    this.emit('upgrade', request, socket, head)
  }
}

// tslint:disable-next-line:max-classes-per-file
export default class HttpMock {
  public nextServerIsListening: boolean
  constructor () {
    this.nextServerIsListening = false
  }

  public createServer () {
    const server = new HttpServerMock()
    server.listening = this.nextServerIsListening
    return server
  }
}
