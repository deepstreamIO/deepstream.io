import { RECORD_ACTIONS, TOPIC, RecordMessage } from '../constants'

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
  private cacheTimeout: number
  private storageTimeout: number

/**
 * This class represents the deletion of a single record. It handles it's removal
 * from cache and storage and handles errors and timeouts
 */
  constructor (config: DeepstreamConfig, services: DeepstreamServices, socketWrapper: SocketWrapper, message: RecordMessage, successCallback: Function, metaData: any) {
    this.metaData = metaData
    this.config = config
    this.services = services
    this.socketWrapper = socketWrapper
    this.message = message
    this.successCallback = successCallback
    this.recordName = message.name
    this.completed = 0
    this.isDestroyed = false

    this.cacheTimeout = setTimeout(
    this.handleError.bind(this, 'cache timeout'),
    this.config.cacheRetrievalTimeout,
  )
    this.services.cache.delete(
    this.recordName,
    this.checkIfDone.bind(this, this.cacheTimeout),
    metaData,
  )

    if (!this.config.storageExclusion || !this.config.storageExclusion.test(this.recordName)) {
      this.storageTimeout = setTimeout(
      this.handleError.bind(this, 'storage timeout'),
      this.config.storageRetrievalTimeout,
    )
      this.services.storage.delete(
      this.recordName,
      this.checkIfDone.bind(this, this.storageTimeout),
      metaData,
    )
    } else {
      this.checkIfDone(null, null)
    }
  }

/**
 * Callback for completed cache and storage interactions. Will invoke
 * _done() once both are completed
 */
  private checkIfDone (timeoutId: NodeJS.Timer | null, error: Error | null): void {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
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
    this.services.logger.info(RECORD_ACTIONS[RECORD_ACTIONS.DELETE], this.recordName, this.metaData)
    this.socketWrapper.sendAckMessage(this.message)
    this.message = Object.assign({}, this.message, { action: RECORD_ACTIONS.DELETED })
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
      action: RECORD_ACTIONS.RECORD_DELETE_ERROR,
      name: this.recordName
    })
    this.services.logger.error(RECORD_ACTIONS[RECORD_ACTIONS.RECORD_DELETE_ERROR], errorMsg, this.metaData)
    this.destroy()
  }
}
