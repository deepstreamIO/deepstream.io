const C = require('../constants/constants')
const { EventEmitter } = require('events')

export default class EventHandler {
  constructor (options, connection) {
    this._options = options
    this._connection = connection
    this._emitter = new EventEmitter()
  }

  subscribe (name, callback) {
    if (!this._emitter.hasListeners(name)) {
      this._connection.send(C.TOPIC.EVENT, C.ACTIONS.SUBSCRIBE, [ name ])
    }

    this._emitter.on(name, callback)
  }

  unsubscribe (name, callback) {
    this._emitter.off(name, callback)

    if (!this._emitter.hasListeners(name)) {
      this._connection.send(C.TOPIC.EVENT, C.ACTIONS.UNSUBSCRIBE, [name])
    }
  }

  emit (name, data) {
    this._connection.send(C.TOPIC.EVENT, C.ACTIONS.EVENT, [ name, 'O' + JSON.stringify(data) ])
    this._emitter.emit(name, data)
  }

  onMessage (message) {
    const [ name, data ] = message.data

    if (message.action === C.ACTIONS.EVENT) {
      if (message.data && message.data.length === 2) {
        this._emitter.emit(name, JSON.parse(data.slice(1)))
      } else {
        this._emitter.emit(name)
      }
    } else if (message.action === C.ACTIONS.ERROR) {
      // TODO
    }
  }
}
