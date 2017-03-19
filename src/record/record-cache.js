'use strict'

const List = require('yallist')

module.exports = class RecordCache {
  constructor ({ size = 128e6 } = {}) {
    this._map = new Map()
    this._list = new List()
    this._space = size
  }

  set (name, record) {
    const size = record[0].length + record[1].length + record[2].length + 64

    this._space -= size

    const node = this._map.get(name)
    if (node) {
      this._space += node.value.size
      node.value.size = size
      node.value.record = record
    } else {
      this._list.unshift({ name, size, record, refs: 0 })
      this._map.set(name, this._list.head)
    }

    this.prune()
  }

  prune () {
    let node = this._list.tail
    while (node && this._space < 0) {
      const prev = node.prev
      if (node.value.refs === 0) {
        this._space += node.value.size
        this._map.delete(node.value.name)
        this._list.removeNode(node)
      } else {
        this._list.unshiftNode(node)
      }
      node = prev
    }
  }

  has (name) {
    return this._map.has(name)
  }

  peek (name) {
    const node = this._map.get(name)
    return node ? node.value.record : undefined
  }

  lock (name) {
    const node = this._map.get(name)
    if (node) {
      ++node.value.refs
    } else {
      this._list.unshift({ name, size: 0, record: undefined, refs: 1 })
      this._map.set(name, this._list.head)
    }
    return node.value.record
  }

  unlock (name) {
    const node = this._map.get(name)
    if (!node) {
      return
    }

    if (--node.value.refs === 0) {
      this.prune()
    }
  }

  get (name) {
    const node = this._map.get(name)
    if (!node) {
      return
    }

    this._list.unshiftNode(node)

    return node.value.record
  }

  del (name) {
    const node = this._map.get(name)
    if (!node) {
      return
    }

    const record = node.value.record

    if (node.value.refs === 0) {
      this._space += node.value.size
      this._map.delete(name)
      this._list.removeNode(node)
    }

    return record
  }
}
