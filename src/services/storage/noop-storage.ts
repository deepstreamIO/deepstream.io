import { DeepstreamPlugin, StorageWriteCallback, StorageReadCallback, DeepstreamStorage } from '@deepstream/types'

export class NoopStorage extends DeepstreamPlugin implements DeepstreamStorage {
  public description = 'Noop Storage'

  public set (key: string, version: number, data: any, callback: StorageWriteCallback) {
    process.nextTick(() => callback(null))
  }

  public get (key: string, callback: StorageReadCallback) {
    process.nextTick(() => callback(null, -1, null))
  }

  public delete (key: string, callback: StorageWriteCallback) {
    process.nextTick(() => callback(null))
  }

  public deleteBulk (key: string[], callback: StorageWriteCallback) {
    process.nextTick(() => callback(null))
  }
}
