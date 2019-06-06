import * as http from 'http'
import { EventEmitter } from 'events'

export default class TestHttpServer extends EventEmitter {
  public server: any
  public lastRequestData: any = null
  public hasReceivedRequest: boolean = false
  public lastRequestHeaders: any = null
  public lastRequestMethod: any = null
  private response: any = null
  private request: any = null

  constructor (private port: number, private callback: Function, private doLog: boolean = false) {
    super()
    this.server = http.createServer(this._onRequest.bind(this))
    this.server.listen(port, this._onListen.bind(this))
  }

  public static getRandomPort () {
    return 1000 + Math.floor(Math.random() * 9000)
  }

  public getRequestHeader (key: string) {
    return this.request.headers[key]
  }

  public reset () {
    this.lastRequestData = null
    this.hasReceivedRequest = false
    this.lastRequestHeaders = null
  }

  public respondWith (statusCode, data) {
    if (typeof data === 'object') {
      data = JSON.stringify(data) // eslint-disable-line
    }
    this.response.setHeader('content-type', 'application/json')
    this.response.writeHead(statusCode)
    this.response.end(data)
  }

  public close (callback) {
    this.server.close(callback)
  }

  public _onListen () {
    this._log.bind(this, `server listening on port ${this.port}`)
    this.callback()
  }

  public _log (msg) {
    if (this.doLog) {
      console.log(msg)
    }
  }

  public _onRequest (request, response) {
    request.postData = ''
    request.setEncoding('utf8')
    request.on('data', this._addChunk.bind(this, request))
    request.on('end', this._onRequestComplete.bind(this, request))
    this.request = request
    this.response = response
  }

  public _addChunk (request, chunk) {
    request.postData += chunk
  }

  public _onRequestComplete (request) {
    this.lastRequestData = JSON.parse(request.postData)
    this.lastRequestHeaders = request.headers
    this.lastRequestMethod = request.method
    this.emit('request-received')
    this._log(`received data ${request.postData}`)
  }
}
