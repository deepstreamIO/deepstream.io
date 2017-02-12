const List = require('yallist')

module.exports = class RecordCache {

  constructor ({ size = 128e6 }) {
    this._map = new Map()
    this._list = new List()
    this._space = size
  }

  onAdded (name) {

  }

  onRemoved (name) {

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
      this.onAdded(name)
    }

    while (this._space < 0) {
      const { size, name } = this._list.pop()
      this._space += size
      this._map.delete(name)
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
      this._map.delete(name)
      this._list.removeNode(node)
      this.onRemoved(name)
    }
  }

}
