import { DeepstreamConfig, DeepstreamServices, SocketWrapper } from '@deepstream/types'
import { Message, RecordMessage, RECORD_ACTION, TOPIC } from '../../constants'
import { isExcluded } from '../../utils/utils'

export default class RecordDeletion {
  private metaData: any
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private socketWrapper: SocketWrapper
  private message: Message
  private successCallback: Function
  private recordName: string
  private completed: 0
  private isDestroyed: boolean
  private cacheTimeout: any
  private storageTimeout: any

/**
 * This class represents the deletion of a single record. It handles it's removal
 * from cache and storage and handles errors and timeouts
 */
  constructor (config: DeepstreamConfig, services: DeepstreamServices, socketWrapper: SocketWrapper, message: RecordMessage, successCallback: Function, metaData: any = {}) {
    this.metaData = metaData
    this.config = config
    this.services = services
    this.socketWrapper = socketWrapper
    this.message = message
    this.successCallback = successCallback
    this.recordName = message.name
    this.completed = 0
    this.isDestroyed = false

    this.onCacheDelete = this.onCacheDelete.bind(this)
    this.onStorageDelete = this.onStorageDelete.bind(this)

    this.cacheTimeout = setTimeout(
      this.handleError.bind(this, 'cache timeout'),
      this.config.record.cacheRetrievalTimeout,
    )
    this.services.cache.delete(
      this.recordName,
      this.onCacheDelete.bind(this),
      metaData,
    )

    if (!isExcluded(this.config.record.storageExclusionPrefixes, this.recordName)) {
      this.storageTimeout = setTimeout(
        this.handleError.bind(this, 'storage timeout'),
        this.config.record.storageRetrievalTimeout,
      )
      this.services.storage.delete(
        this.recordName,
        this.onStorageDelete,
        metaData,
      )
    } else {
      this.onStorageDelete(null)
    }
  }

/**
 * Callback for completed cache and storage interactions. Will invoke
 * _done() once both are completed
 */
  private onCacheDelete (error: string | null): void {
    clearTimeout(this.cacheTimeout)
    this.stageComplete(error)
  }

  private onStorageDelete (error: string | null) {
    clearTimeout(this.storageTimeout)
    this.stageComplete(error)
  }

  private stageComplete (error: string | null) {
    this.completed++

    if (this.isDestroyed) {
      return
    }

    if (error) {
      this.handleError(error.toString())
      return
    }

    if (this.completed === 2) {
      this.done()
    }
  }

/**
 * Callback for successful deletions. Notifies the original sender and calls
 * the callback to allow the recordHandler to broadcast the deletion
 */
  private done (): void {
    this.services.logger.info(RECORD_ACTION[RECORD_ACTION.DELETE], this.recordName, this.metaData)
    this.socketWrapper.sendMessage({ topic: TOPIC.RECORD, action: RECORD_ACTION.DELETE_SUCCESS, name: this.message.name })
    this.message = Object.assign({}, this.message, { action: RECORD_ACTION.DELETED })
    this.successCallback(this.recordName, this.message, this.socketWrapper)
    this.destroy()
  }

/**
 * Destroyes the class and null down its dependencies
 */
  private destroy (): void {
    clearTimeout(this.cacheTimeout)
    clearTimeout(this.storageTimeout)
    this.isDestroyed = true
    // this.options = null
    // this.socketWrapper = null
    // this.message = null
  }

/**
 * Handle errors that occured during deleting the record
 */
  private handleError (errorMsg: string) {
    this.socketWrapper.sendMessage({
      topic: TOPIC.RECORD,
      action: RECORD_ACTION.RECORD_DELETE_ERROR,
      name: this.recordName
    })
    this.services.logger.error(RECORD_ACTION[RECORD_ACTION.RECORD_DELETE_ERROR], errorMsg, this.metaData)
    this.destroy()
  }
}
