const List = require('yallist')

module.exports = class RecordCache {
  constructor ({ size = 128e6 } = {}) {
    this._map = new Map()
    this._list = new List()
    this._space = size
  }

  get (name) {
    const node = this._map.get(name)
    return node ? node.value : undefined
  }

  set (name, version, message) {
    const size = name.length + version.length + message.length + 32

    this._space -= size

    let node = this._map.get(name)
    if (node) {
      this._space += node.value.size
      node.value.size = size
      node.value.version = version
      node.value.message = message
    } else {
      node = new List.Node({
        name,
        size,
        version,
        message
      })
      this._list.unshiftNode(node)
      this._map.set(name, node)
    }

    this._prune()
  }

  lock (name) {
    const node = this._map.get(name)

    if (!node) {
      const size = name.length + 32
      this._space -= size
      this._map.set(name, new List.Node({
        name,
        size,
        version: undefined,
        message: undefined
      }))
    } else {
      if (node.list) {
        node.list.removeNode(node)
      }

      return node.value
    }
  }

  unlock (name) {
    const node = this._map.get(name)

    if (!node) {
      return
    }

    this._list.unshiftNode(node)

    this._prune()
  }

  _prune () {
    let node = this._list.tail
    while (node && this._space < 0) {
      const prev = node.prev
      this._space += node.value.size
      this._map.delete(node.value.name)
      this._list.removeNode(node)
      node = prev
    }
  }
}
