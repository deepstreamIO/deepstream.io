import { EventEmitter } from 'events'
const util = require('util')

export class HttpServerMock extends EventEmitter {
  public listening: boolean
  public closed: boolean
  private port: any
  private host: any

  constructor () {
    super()
    this.listening = false
    this.closed = false
  }

  public listen (port, host, callback) {
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

  public close (callback) {
    this.closed = true
    this.emit('close')
    if (callback) {
      callback()
    }
  }

  public address () {
    return {
      address: this.host,
      port: this.port
    }
  }

  public _simulateUpgrade (socket) {
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
