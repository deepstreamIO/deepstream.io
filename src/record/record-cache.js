const List = require('yallist')

module.exports = class RecordCache {
  constructor ({ size = 128e6 } = {}) {
    this._map = new Map()
    this._list = new List()
    this._space = size
  }

  has (name) {
    return this._map.has(name)
  }

  get (name) {
    const node = this._map.get(name)
    if (!node) {
      return
    }

    return node.value.record
  }

  set (name, record) {
    const size = record
      ? name.length + record.version.length + record.message.length + 32
      : 32

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
      this._space += node.value.size
      this._map.delete(node.value.name)
      this._list.removeNode(node)
      node = prev
    }
  }

  lock (name) {
    let node = this._map.get(name)
    if (!node) {
      const size = 32 + name.length
      this._space -= size
      node = new List.Node({ name, size, record: undefined, refs: 0 })
      this._map.set(name, node)
    }
    if (node.list) {
      node.list.removeNode(node)
    }
    ++node.value.refs
  }

  unlock (name) {
    const node = this._map.get(name)
    if (!node) {
      return
    }

    if (--node.value.refs === 0) {
      this._list.unshiftNode(node)
    }
  }
}
