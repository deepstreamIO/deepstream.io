import { EventEmitter } from 'events'
import {JSONValue} from '../../binary-protocol/src/message-constants'
import { StoragePlugin, StorageWriteCallback, StorageReadCallback } from '../types'

export default class LocalCache extends EventEmitter implements StoragePlugin {
  public description = 'local cache'
  public isReady: boolean = true
  public apiVersion = 2

  private data = new Map<string, { version: number, data: JSONValue }>()

  // @ts-ignore
  constructor (private config?: InternalDeepstreamConfig, private services?: DeepstreamServices) {
    super()
  }

  public set (key: string, version: number, data: any, callback: StorageWriteCallback) {
    this.data.set(key, { version, data })
    process.nextTick(() => callback(null))
  }

  public get (key: string, callback: StorageReadCallback) {
    const data = this.data.get(key)
    if (!data) {
      process.nextTick(() => callback(null, -1, null))
    } else {
      process.nextTick(() => callback(null, data.version, data.data))
    }
  }

  public delete (key: string, callback: StorageWriteCallback) {
    this.data.delete(key)
    process.nextTick(() => callback(null))
  }
}
