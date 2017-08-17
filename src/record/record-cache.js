module.exports = class RecordCache {
  constructor ({ size = 128e6 } = {}) {
    this._map = new Map()
    this._space = size
    this._pool = []
    this._tail = null
    this._head = null
  }

  get (name) {
    return this._map.get(name)
  }

  set (node, name, version, message, sender) {
    const size = name.length + version.length + message.length

    this._space -= size

    if (node) {
      this._space += node.size
    } else {
      node = this._pool.pop() || this._allocNode()
      this._unshiftNode(node)
      this._map.set(name, node)
    }

    node.size = size
    node.name = name
    node.version = version
    node.message = message
    node.sender = sender

    return node
  }

  lock (name) {
    let node = this._map.get(name)

    if (!node) {
      const size = name.length
      this._space -= size
      node = this._pool.pop() || this._allocNode()
      node.name = name
      node.size = size
      this._map.set(name, node)
    } else {
      if (node.list) {
        this._removeNode(node)
      }

      return node
    }
  }

  unlock (name) {
    const node = this._map.get(name)

    if (!node) {
      return
    }

    this._unshiftNode(node)

    this._prune()
  }

  _prune () {
    let node = this._tail
    while (node && this._space < 0) {
      const prev = node.prev
      this._space += node.size

      this._map.delete(node.name)
      this._removeNode(node)
      node.size = null
      node.name = null
      node.version = null
      node.message = null
      node.sender = null
      this._pool.push(node)

      node = prev
    }
  }

  _allocNode () {
    this._space -= 80
    return {
      // yallist
      next: null,
      prev: null,
      list: null,
      // meta
      size: 0,
      name: null,
      // record
      version: null,
      message: null,
      sender: null
    }
  }

  _unshiftNode (node) {
    if (node === this._head) {
      return
    }

    if (node.list) {
      this._removeNode(node)
    }

    const head = this._head
    node.list = this
    node.next = head

    if (head) {
      head.prev = node
    }

    this._head = node

    if (!this._tail) {
      this._tail = node
    }
  }

  _removeNode (node) {
    const next = node.next
    const prev = node.prev

    if (next) {
      next.prev = prev
    }

    if (prev) {
      prev.next = next
    }

    if (node === this._head) {
      this._head = next
    }

    if (node === this._tail) {
      this._tail = prev
    }

    node.next = null
    node.prev = null
    node.list = null
  }
}
