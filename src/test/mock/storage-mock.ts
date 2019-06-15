import { EventEmitter } from 'events'
import { StoragePlugin, StorageWriteCallback, StorageReadCallback } from '../../types'
import { JSONObject } from '../../constants';

export default class StorageMock extends EventEmitter implements StoragePlugin  {
  public values = new Map<string, { version: number, value: JSONObject }>()
  public failNextSet: boolean = false
  public nextOperationWillBeSuccessful: boolean = true
  public nextOperationWillBeSynchronous: boolean = true
  public nextGetWillBeSynchronous: boolean = true
  public lastGetCallback: Function | null = null
  public lastRequestedKey: string | null = null
  public lastSetKey: string | null = null
  public lastSetVersion: number | null = null
  public lastSetValue: object | null = null
  public completedSetOperations: any
  public completedDeleteOperations: any
  public getCalls: any
  public setTimeout: any
  public getTimeout: any
  public isReady: boolean
  public description: string

  constructor () {
    super()
    this.reset()
    this.isReady = true
    this.description = ''
  }

  public reset () {
    this.values.clear()
    this.failNextSet = false
    this.nextOperationWillBeSuccessful = true
    this.nextOperationWillBeSynchronous = true
    this.nextGetWillBeSynchronous = true
    this.lastGetCallback = null
    this.lastRequestedKey = null
    this.lastSetKey = null
    this.lastSetVersion = null
    this.lastSetValue = null
    this.completedSetOperations = 0
    this.completedDeleteOperations = 0
    this.getCalls = []
    clearTimeout(this.getTimeout)
    clearTimeout(this.setTimeout)
  }

  public delete (key: string, callback: StorageWriteCallback) {
    if (this.nextOperationWillBeSynchronous) {
      this.completedDeleteOperations++
      if (this.nextOperationWillBeSuccessful) {
        this.values.delete(key)
        callback(null)
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

  public hadGetFor (key: string) {
    for (let i = 0; i < this.getCalls.length; i++) {
      if (this.getCalls[i][0] === key) {
        return true
      }
    }

    return false
  }

  public triggerLastGetCallback (errorMessage: string, value: JSONObject) {
    if (this.lastGetCallback) {
      this.lastGetCallback(errorMessage, value)
    }
  }

  public get (key: string, callback: StorageReadCallback) {
    this.getCalls.push(arguments)
    this.lastGetCallback = callback
    this.lastRequestedKey = key
    const set = this.values.get(key) || {
      version: -1,
      value: null
    }

    if (this.nextGetWillBeSynchronous === true) {
      callback(this.nextOperationWillBeSuccessful ? null : 'storageError', set.version !== undefined ? set.version : -1, set.value ? Object.assign({}, set.value) : null)
    } else {
      this.getTimeout = setTimeout(() => {
        callback(this.nextOperationWillBeSuccessful ? null : 'storageError', set.version !== undefined ? set.version : -1, set.value ? Object.assign({}, set.value) : null)
      }, 25)
    }
  }

  public set (key: string, version: number, value: JSONObject, callback: StorageWriteCallback) {
    const set = { version, value }

    this.lastSetKey = key
    this.lastSetVersion = version
    this.lastSetValue = value

    if (this.nextOperationWillBeSuccessful) {
      this.values.set(key, set)
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
