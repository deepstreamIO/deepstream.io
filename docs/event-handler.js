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
    this._connection.send(C.TOPIC.EVENT, C.ACTIONS.EVENT, [ name, buildTyped(data) ])
    this._emitter.emit(name, data)
  }

  onMessage (message) {
    const [ name, data ] = message.action !== C.ACTIONS.ERROR
      ? message.data
      : message.data.slice(1).concat(message.data.slice(0, 1))

    if (message.action === C.ACTIONS.EVENT) {
      if (message.data && message.data.length === 2) {
        this._emitter.emit(name, parseTyped(data, this))
      } else {
        this._emitter.emit(name)
      }
    } else {
      const listener = this._listeners.get(name)

      if (listener) {
        listener._$onMessage(message)
      }
    }
  }
}

function buildTyped (value) {
  const type = typeof value

  if (type === 'string') {
    return C.TYPES.STRING + value
  }

  if (value === null) {
    return C.TYPES.NULL
  }

  if (type === 'object') {
    return C.TYPES.OBJECT + JSON.stringify(value)
  }

  if (type === 'number') {
    return C.TYPES.NUMBER + value.toString()
  }

  if (value === true) {
    return C.TYPES.TRUE
  }

  if (value === false) {
    return C.TYPES.FALSE
  }

  if (value === undefined) {
    return C.TYPES.UNDEFINED
  }

  throw new Error(`Can't serialize type ${value}`)
}

function parseTyped (value) {
  const type = value.charAt(0)

  if (type === C.TYPES.STRING) {
    return value.substr(1)
  }

  if (type === C.TYPES.OBJECT) {
    return JSON.parse(value.substr(1))
  }

  if (type === C.TYPES.NUMBER) {
    return parseFloat(value.substr(1))
  }

  if (type === C.TYPES.NULL) {
    return null
  }

  if (type === C.TYPES.TRUE) {
    return true
  }

  if (type === C.TYPES.FALSE) {
    return false
  }

  if (type === C.TYPES.UNDEFINED) {
    return undefined
  }

  throw new Error(`Can't deserialize value ${value}`)
}
