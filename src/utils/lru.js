const Deque = require('double-ended-queue')

module.exports = class LRU {

  constructor (options) {
    this.size = 0
    this.max = options.max
    this._onAdded = options.onAdded
    this._onRemoved = options.onRemoved
    this._length = options.length
    this._map = new Map()
    this._list = new Deque(64e3)
  }

  set (key, value) {
    const node = this._map.get(key)
    if (node) {
      node.value = value
    } else {
      const node = {
        key,
        value,
        length: this._length(value)
      }

      this.size += node.length

      while (this.size >= this.max) {
        this._map.delete(node.key)
        this.size -= node.length
        this._onRemoved(node.key, node.value)
      }

      this._list.unshift(node)

      this._map.set(key, node)

      this._onAdded(key, value)
    }
  }

  has (key) {
    return this._map.has(key)
  }

  get (key) {
    const node = this._map.get(key)
    if (!node) {
      return
    }
    return node.value
  }

  delete (key) {
    const node = this._map.get(key)
    if (!node) {
      return
    }
    this._map.delete(node.key)
    this.size -= node.length
    node.length = 0
    this._onRemoved(node.key, node.value)
  }

}
