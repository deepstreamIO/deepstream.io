module.exports = class RecordCache {
  constructor ({ size = 128e6 } = {}) {
    this._space = size
    this._pool = []
    this._tail = null
    this._head = null
    this._map = new Map()
  }

  get (name) {
    let node = this._map.get(name)
    if (!node) {
      node = this._pool.pop() || this._allocNode()
      node.name = name
      this._map.set(node.name, node)
    }
    return node
  }

  set (node, version, message, sender) {
    const size = node.name.length + version.length + message.length

    this._space -= size

    if (node) {
      this._space += node.size
    } else {
      node = this._pool.pop() || this._allocNode()
      this._unshiftNode(node)
    }

    node.size = size
    node.version = version
    node.message = message
    node.sender = sender

    return node
  }

  lock (node) {
    if (node.list) {
      this._removeNode(node)
    }
  }

  unlock (node) {
    this._unshiftNode(node)
    this._prune()
  }

  _prune () {
    let node = this._tail
    while (node && this._space < 0) {
      const prev = node.prev
      this._space += node.size

      this._removeNode(node)
      this._map.delete(node.name, node)
      node.name = null
      node.size = null
      node.version = null
      node.message = null
      node.sender = null
      this._pool.push(node)

      node = prev
    }
  }

  _allocNode () {
    this._space -= 128
    return {
      name: null,
      // yallist
      next: null,
      prev: null,
      list: null,
      // record-cache
      size: 0,
      version: null,
      message: null,
      sender: null,
      // subscription-registry
      senders: new Map(),
      sockets: new Set(),
      shared: '',
      // listener-registry
      timeout: null,
      history: null,
      active: null,
      socket: null,
      pattern: null,
      matches: null
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
