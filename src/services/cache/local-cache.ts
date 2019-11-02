import { DeepstreamPlugin, DeepstreamCache, StorageWriteCallback, StorageReadCallback, StorageHeadBulkCallback, StorageHeadCallback } from '@deepstream/types'
import { JSONValue } from '../../constants'

export class LocalCache extends DeepstreamPlugin implements DeepstreamCache {
  public description = 'Local Cache'

  private data = new Map<string, { version: number, data: JSONValue }>()

  public head (recordName: string, callback: StorageHeadCallback) {
    const data = this.data.get(recordName)
    process.nextTick(() => callback(null, data ? data.version : -1))
  }

  public headBulk (recordNames: string[], callback: StorageHeadBulkCallback) {
    const versions: any = {}
    const missing: any = []
    for (const name of recordNames) {
      const data = this.data.get(name)
      if (data) {
        versions[name] = data.version
      } else {
        missing.push(name)
      }
    }
    process.nextTick(() => callback(null, versions, missing))
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

  public deleteBulk (keys: string[], callback: StorageWriteCallback) {
    keys.forEach((key) => this.data.delete(key))
    process.nextTick(() => callback(null))
  }
}

export default LocalCache
