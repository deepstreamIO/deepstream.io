const List = require('yallist')
const { EventEmitter } = require('events')

module.exports = class RecordCache extends EventEmitter {

  constructor ({ size = 128e6 } = {}) {
    super()
    this._map = new Map()
    this._locks = new Set()
    this._list = new List()
    this._space = size
  }

  set (name, record) {
    const value = {
      name,
      record,
      size: record[0].length + record[1].length + record[2].length + 64
    }

    this._space -= value.size

    const node = this._map.get(name)
    if (node) {
      this._space += node.value.size
      node.value = value
    } else {
      this._list.unshift(value)
      this._map.set(name, this._list.head)
      this.emit('added', name)
    }

    let it = this._list.tail
    while (this._space < 0 && it !== this._list.head) {
      if (!this._locks.has(it.value.name)) {
        this._space += it.value.size
        this._map.delete(it.value.name)
        this.emit('removed', it.value.name)

        it = it.prev
        this._list.removeNode(it)
      } else {
        this._list.unshiftNode(it)
        it = it.prev
      }
    }
  }

  has (name) {
    return this._map.has(name)
  }

  peek (name) {
    const node = this._map.get(name)
    if (node) {
      return node.value.record
    } else {
      return undefined
    }
  }

  lock (name) {
    this._locks.add(name)
  }

  unlock (name) {
    this._locks.delete(name)
  }

  get (name) {
    const node = this._map.get(name)
    if (node) {
      this._list.unshiftNode(node)
      return node.value.record
    } else {
      return undefined
    }
  }

  del (name) {
    const node = this._map.get(name)
    if (node) {
      this._space += node.value.size
      this._list.removeNode(node)
      this._map.delete(name)
      this.emit('removed', name)
    }
  }

}
