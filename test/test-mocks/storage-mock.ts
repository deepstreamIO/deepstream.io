export default class StorageMock {
  public values: any
  public failNextSet: any
  public nextOperationWillBeSuccessful: any
  public nextOperationWillBeSynchronous: any
  public nextGetWillBeSynchronous: any
  public lastGetCallback: any
  public lastRequestedKey: any
  public lastSetKey: any
  public lastSetValue: any
  public completedSetOperations: any
  public completedDeleteOperations: any
  public getCalls: any
  public setTimeout: any
  public getTimeout: any

  constructor () {
    this.reset()
  }

  public reset () {
    this.values = {}
    this.failNextSet = false
    this.nextOperationWillBeSuccessful = true
    this.nextOperationWillBeSynchronous = true
    this.nextGetWillBeSynchronous = true
    this.lastGetCallback = null
    this.lastRequestedKey = null
    this.lastSetKey = null
    this.lastSetValue = null
    this.completedSetOperations = 0
    this.completedDeleteOperations = 0
    this.getCalls = []
    clearTimeout(this.getTimeout)
    clearTimeout(this.setTimeout)
  }

  public delete (key, callback) {
    if (this.nextOperationWillBeSynchronous) {
      this.completedDeleteOperations++
      if (this.nextOperationWillBeSuccessful) {
        delete this.values[key]
        callback()
      } else {
        callback('storageError')
        return
      }
    } else {
      setTimeout(() => {
        this.completedDeleteOperations++
        callback(this.nextOperationWillBeSuccessful ? null : 'storageError')
      }, 10)
    }
  }

  public hadGetFor (key) {
    for (let i = 0; i < this.getCalls.length; i++) {
      if (this.getCalls[i][0] === key) {
        return true
      }
    }

    return false
  }

  public triggerLastGetCallback (errorMessage, value) {
    this.lastGetCallback(errorMessage, value)
  }

  public get (key, callback) {
    this.getCalls.push(arguments)
    this.lastGetCallback = callback
    this.lastRequestedKey = key
    const value = this.values[key]

    if (this.nextGetWillBeSynchronous === true) {
      callback(this.nextOperationWillBeSuccessful ? null : 'storageError', value ? Object.assign({}, value) : null)
    } else {
      this.getTimeout = setTimeout(() => {
        callback(this.nextOperationWillBeSuccessful ? null : 'storageError', value ? Object.assign({}, value) : null)
      }, 25)
    }
  }

  public set (key, value, callback) {
    this.lastSetKey = key
    this.lastSetValue = value
    if (value._d === undefined) {
      value = { _v: 0, _d: value }
    }
    if (this.nextOperationWillBeSuccessful) {
      this.values[key] = value
    }

    if (this.nextOperationWillBeSynchronous) {
      this.completedSetOperations++
      if (this.failNextSet) {
        this.failNextSet = false
        callback('storageError')
        return
      }
      callback(this.nextOperationWillBeSuccessful ? null : 'storageError')
    } else {
      this.setTimeout = setTimeout(() => {
        this.completedSetOperations++
        callback(this.nextOperationWillBeSuccessful ? null : 'storageError')
      }, 50)
    }
  }
}
