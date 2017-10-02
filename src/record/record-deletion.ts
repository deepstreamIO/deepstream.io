import { TOPIC, EVENT, ACTIONS } from '../constants'

export default class RecordDeletion {
  private metaData: any
  private options: DeepstreamOptions
  private socketWrapper: SocketWrapper
  private message: Message
  private successCallback: Function
  private recordName: string
  private completed: 0
  private isDestroyed: boolean
  private cacheTimeout: NodeJS.Timer
  private storageTimeout: NodeJS.Timer

/**
 * This class represents the deletion of a single record. It handles it's removal
 * from cache and storage and handles errors and timeouts
 */
  constructor (options: DeepstreamOptions, socketWrapper: SocketWrapper, message: Message, successCallback: Function, metaData: any) {
    this.metaData = metaData
    this.options = options
    this.socketWrapper = socketWrapper
    this.message = message
    this.successCallback = successCallback
    this.recordName = message.name
    this.completed = 0
    this.isDestroyed = false

    this.cacheTimeout = setTimeout(
    this.handleError.bind(this, 'cache timeout'),
    this.options.cacheRetrievalTimeout
  )
    this.options.cache.delete(
    this.recordName,
    this.checkIfDone.bind(this, this.cacheTimeout),
    metaData
  )

    if (!this.options.storageExclusion || !this.options.storageExclusion.test(this.recordName)) {
      this.storageTimeout = setTimeout(
      this.handleError.bind(this, 'storage timeout'),
      this.options.storageRetrievalTimeout
    )
      this.options.storage.delete(
      this.recordName,
      this.checkIfDone.bind(this, this.storageTimeout),
      metaData
    )
    } else {
      this.checkIfDone(null, null)
    }
  }

/**
 * Callback for completed cache and storage interactions. Will invoke
 * _done() once both are completed
 */
  private checkIfDone (timeoutId: NodeJS.Timer, error: Error): void {
    clearTimeout(timeoutId)
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
    this.options.logger.info(EVENT.RECORD_DELETION, this.recordName, this.metaData)
    this.socketWrapper.sendAckMessage(this.message)
    // Will change with new protocol
    this.message = Object.assign({}, this.message, { isAck: true })
    this.successCallback(this.recordName, this.message, this.socketWrapper)
    this.destroy()
  }

/**
 * Destroyes the class and null down its dependencies
 */
  private destroy (): void {
    clearTimeout(this.cacheTimeout)
    clearTimeout(this.storageTimeout)
    this.options = null
    this.socketWrapper = null
    this.message = null
    this.isDestroyed = true
  }

/**
 * Handle errors that occured during deleting the record
 */
  private handleError (errorMsg: string) {
    this.socketWrapper.sendError(this.message, EVENT.RECORD_DELETE_ERROR)
    this.options.logger.error(EVENT.RECORD_DELETE_ERROR, errorMsg, this.metaData)
    this.destroy()
  }
}
