import { EventEmitter } from 'events'
import { StoragePlugin, StorageWriteCallback, StorageReadCallback } from '../types';

export default class NoopStorage extends EventEmitter implements StoragePlugin {
  public description = 'noop storage'
  public isReady: boolean = true
  public apiVersion: number = 2

  // @ts-ignore
  constructor (private config?: InternalDeepstreamConfig, private services?: DeepstreamServices) {
    super()
  }

  public set (key: string, version: number, data: any, callback: StorageWriteCallback) {
    process.nextTick(() => callback(null))
  }

  public get (key: string, callback: StorageReadCallback) {
    process.nextTick(() => callback(null, -1, null))
  }

  public delete (key: string, callback: StorageWriteCallback) {
    process.nextTick(() => callback(null))
  }
}
