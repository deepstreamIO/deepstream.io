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
    this.server = http.createServer(this.onRequest.bind(this))
    this.server.listen(port, this.onListen.bind(this))
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

  public respondWith (statusCode: number, data: any) {
    if (typeof data === 'object') {
      data = JSON.stringify(data) // eslint-disable-line
    }
    this.response.setHeader('content-type', 'application/json')
    this.response.writeHead(statusCode)
    this.response.end(data)
  }

  public close (callback: Function) {
    this.server.close(callback)
  }

  private onListen () {
    this.log(`server listening on port ${this.port}`)
    this.callback()
  }

  private log (msg: string) {
    if (this.doLog) {
      console.log(msg)
    }
  }

  private onRequest (request: http.IncomingMessage, response: http.OutgoingMessage) {
    let postData = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      postData += chunk
    })
    request.on('end', () => {
      this.lastRequestData = JSON.parse(postData)
      this.lastRequestHeaders = request.headers
      this.lastRequestMethod = request.method
      this.emit('request-received')
      this.log(`received data ${postData}`)
    })
    this.request = request
    this.response = response
  }
}
