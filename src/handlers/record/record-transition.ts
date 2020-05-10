import { setValue as setPathValue } from '../../utils/json-path'
import RecordHandler from './record-handler'
import { recordRequest } from './record-request'
import { RecordWriteMessage, TOPIC, RECORD_ACTION, Message } from '../../constants'
import { SocketWrapper, DeepstreamConfig, DeepstreamServices, MetaData, EVENT } from '@deepstream/types'
import { isOfType, isExcluded } from '../../utils/utils'

interface Step {
  message: RecordWriteMessage
  sender: SocketWrapper
}

export class RecordTransition {
/**
 * This class manages one or more simultanious updates to the data of a record.
 * But: Why does that need to be so complicated and why does this class even exist?
 *
 * In short: Cross-network concurrency. If your record is written to by a single datasource
 * and consumed by many clients, this class is admittably overkill, but if deepstream is used to
 * build an app that allows many users to collaboratively edit the same dataset, sooner or later
 * two of them will do so at the same time and clash.
 *
 * Every deepstream record therefor has a  number that's incremented with every change.
 * Every client sends this version number along with the changed data. If no other update has
 * been received for the same version in the meantime, the update is accepted and not much more
 * happens.
 *
 * If, however, another clients was able to send its updated version before this update was
 * processed, the second (later) update for the same version number is rejected and the issuing
 * client is notified of the change.
 *
 * The client is then expected to merge its changes on top of the new version and re-issue the
 * update message.
 *
 * Please note: For performance reasons, succesful updates are not explicitly acknowledged.
 *
 * It's this class' responsibility to manage this. It will be created when an update arrives and
 * only exist as long as it takes to apply it and make sure that no subsequent updates for the
 * same version are requested.
 *
 * Once the update is applied it will notify the record-handler to broadcast the
 * update and delete the instance of this class.
 */
 public isDestroyed: boolean = false

 private steps: Step[] = []
 private version: number = -1
 private data: any = null
 private currentStep: Step | null = null
 private recordRequestMade: boolean = false
 private existingVersions: Step[] = []
 private lastVersion: number | null = null
 private readonly writeAckSockets = new Map<SocketWrapper, { [correlationId: string]: number }>()
 private pendingStorageWrites: number = 0
 private pendingCacheWrites: number = 0

  constructor (private name: string, private config: DeepstreamConfig, private services: DeepstreamServices, private recordHandler: RecordHandler, private readonly metaData: MetaData) {
    this.onCacheSetResponse = this.onCacheSetResponse.bind(this)
    this.onStorageSetResponse = this.onStorageSetResponse.bind(this)
    this.onRecord = this.onRecord.bind(this)
    this.onFatalError = this.onFatalError.bind(this)
  }

/**
 * Checks if a specific version number is already processed or
 * queued for processing
 */
  public hasVersion (version: number): boolean {
    if (this.lastVersion === null) {
      return false
    }
    return version !== -1 && version <= this.lastVersion
  }

/**
 * Send version exists error if the record has been already loaded, else
 * store the version exists error to send to the sockerWrapper once the
 * record is loaded
 */
  public sendVersionExists (step: Step): void {
    const socketWrapper = step.sender
    if (this.data) {
      socketWrapper.sendMessage({
        topic: TOPIC.RECORD,
        action: RECORD_ACTION.VERSION_EXISTS,
        originalAction: step.message.action,
        name: this.name,
        version: this.version,
        parsedData: this.data,
        isWriteAck: step.message.isWriteAck,
        correlationId: step.message.correlationId
      })

      this.services.logger.warn(
        RECORD_ACTION[RECORD_ACTION.VERSION_EXISTS],
        `${socketWrapper.userId} tried to update record ${this.name} to version ${step.message.version} but it already was ${this.version}`,
        this.metaData,
      )
    } else {
      this.existingVersions.push({
        sender: socketWrapper,
        message: step.message,
      })
    }
  }

/**
 * Adds a new step (either an update or a patch) to the record. The step
 * will be queued or executed immediatly if the queue is empty
 *
 * This method will also retrieve the current record's data when called
 * for the first time
 */
  public add (socketWrapper: SocketWrapper, message: RecordWriteMessage, upsert: boolean = false): void {
    const version = message.version
    const update = {
      message,
      sender: socketWrapper,
    }

    const result = socketWrapper.parseData(message)
    if (result instanceof Error) {
      socketWrapper.sendMessage({
        topic: TOPIC.RECORD,
        action: RECORD_ACTION.INVALID_MESSAGE_DATA,
        data: message.data
      })
      return
    }

    if (message.action === RECORD_ACTION.UPDATE) {
      if (!isOfType(message.parsedData, 'object') && !isOfType(message.parsedData, 'array')) {
        socketWrapper.sendMessage({ ...message,
          action: RECORD_ACTION.INVALID_MESSAGE_DATA,
          originalAction: message.action,
        })
        return
      }
    }

    if (this.lastVersion !== null && version > this.lastVersion + 1) {
      socketWrapper.sendMessage({ ...message,
        action: RECORD_ACTION.INVALID_VERSION,
        originalAction: message.action,
      })
      return
    }

    if (this.lastVersion !== null && this.lastVersion !== version - 1) {
      this.sendVersionExists(update)
      return
    }

    if (version !== -1) {
      this.lastVersion = version
    }
    this.steps.push(update)

    if (this.recordRequestMade === false) {
      this.recordRequestMade = true
      recordRequest(
        this.name,
        this.config,
        this.services,
        socketWrapper,
        (r: string, v: number, d: any) => this.onRecord(v, d, upsert),
        this.onCacheRequestError,
        this,
        this.metaData,
        undefined,
        false
      )
    } else if (this.steps.length === 1) {
      this.next()
    }
  }

/**
 * Destroys the instance
 */
  public destroy (error?: string | null): void {
    if (this.isDestroyed) {
      return
    }

    if (error) {
      this.sendWriteAcknowledgementErrors(error.toString())
    }

    this.recordHandler.transitionComplete(this.name)
    this.isDestroyed = true
  }

/**
 * Callback for successfully retrieved records
 */
  private onRecord (version: number, data: any, upsert: boolean) {
    if (data === null) {
      if (!upsert) {
        this.onFatalError(`Received update for non-existant record ${this.name}`)
        return
      }
      this.data = {}
      this.version = 0
    } else {
      this.version = version
      this.data = data
    }
    this.flushVersionExists()
    this.next()
  }

/**
 * Once the record is loaded this method is called recoursively
 * for every step in the queue of pending updates.
 *
 * It will apply every patch or update and - once done - either
 * call itself to process the next one or destroy the RecordTransition
 * of the queue has been drained
 */
  private next (): void {
    if (this.isDestroyed === true) {
      return
    }

    if (this.data === null) {
      return
    }

    const currentStep = this.steps.shift()
    if (!currentStep) {
      this.destroy(null)
      return
    }

    this.currentStep = currentStep
    let message = currentStep.message

    if (message.version === -1) {
      message = Object.assign({}, message, { version: this.version + 1 })
      currentStep.message = message
    }

    if (message.version > this.version + 1) {
      currentStep.sender.sendMessage({ ...message,
        action: RECORD_ACTION.INVALID_VERSION,
        originalAction: currentStep.message.action,
        version: this.version
      })
      return
    }

    if (this.version !== message.version - 1) {
      this.sendVersionExists(currentStep)
      this.next()
      return
    }

    this.version = message.version

    if (message.path) {
      setPathValue(this.data, message.path, message.parsedData)
    } else {
      this.data = message.parsedData
    }

    /*
   * Please note: saving to storage is called first to allow for synchronous cache
   * responses to destroy the transition, it is however not on the critical path
   * and the transition will continue straight away, rather than wait for the storage response
   * to be returned.
   *
   * If the storage response is asynchronous and write acknowledgement is enabled, the transition
   * will not be destroyed until writing to storage is finished
   */
    if (!isExcluded(this.config.record.storageExclusionPrefixes, this.name)) {
      this.pendingStorageWrites++
      if (message.isWriteAck) {
        this.setUpWriteAcknowledgement(message, this.currentStep.sender)
        this.services.storage.set(this.name, this.version, this.data, (error) => this.onStorageSetResponse(error, this.currentStep!.sender, message), this.metaData)
      } else {
        this.services.storage.set(this.name, this.version, this.data, this.onStorageSetResponse, this.metaData)
      }
    }

    this.pendingCacheWrites++
    if (message.isWriteAck) {
      this.setUpWriteAcknowledgement(message, this.currentStep.sender)
      this.services.cache.set(this.name, this.version, this.data, (error) => this.onCacheSetResponse(error, this.currentStep!.sender, message), this.metaData)
    } else {
      this.services.cache.set(this.name, this.version, this.data, this.onCacheSetResponse, this.metaData)
    }
  }

  private setUpWriteAcknowledgement (message: Message, socketWrapper: SocketWrapper) {
    const correlationId = message.correlationId as string
    const response = this.writeAckSockets.get(socketWrapper)
    if (!response) {
      this.writeAckSockets.set(socketWrapper, { [correlationId]: 1 })
      return
    }
    response[correlationId] = response[correlationId] ? response[correlationId] + 1 : 1
    this.writeAckSockets.set(socketWrapper, response)
  }

/**
 * Send all the stored version exists errors once the record has been loaded.
 */
  private flushVersionExists (): void {
    for (let i = 0; i < this.existingVersions.length; i++) {
      this.sendVersionExists(this.existingVersions[i])
    }
    this.existingVersions = []
  }

  private handleWriteAcknowledgement (error: string | null, socketWrapper: SocketWrapper, originalMessage: Message) {
    const correlationId = originalMessage.correlationId as string
    const response = this.writeAckSockets.get(socketWrapper)
    if (!response) {
      return
    }

    response[correlationId]--
    if (response[correlationId] === 0) {
      socketWrapper.sendMessage({
        topic: TOPIC.RECORD,
        action: RECORD_ACTION.WRITE_ACKNOWLEDGEMENT,
        name: originalMessage.name,
        correlationId,
        isWriteAck: true
      })
      delete response[correlationId]
    }

    if (Object.keys(response).length === 0) {
      this.writeAckSockets.delete(socketWrapper)
    }
  }

  private onCacheRequestError (error: string) {
    const errorMessage = `Cache retrieval error, nuking record transition for ${this.name}, ${error}`
    this.services.logger.error(EVENT.ERROR, errorMessage)
    this.destroy(errorMessage)
  }

/**
 * Callback for responses returned by cache.set(). If an error
 * is returned the queue will be destroyed, otherwise
 * the update will be broadcast to other subscribers and the
 * next step invoked
 */
  private onCacheSetResponse (error: string | null, socketWrapper?: SocketWrapper, message?: Message): void {
    if (this.currentStep === null) {
      const errorMessage = `Cache results received without a valid step in record transition for ${this.name}`
      this.services.logger.error(EVENT.ERROR, errorMessage)
      this.destroy(errorMessage)
      return
    }

    if (message && socketWrapper) {
      this.handleWriteAcknowledgement(error, socketWrapper, message)
    }
    if (error) {
      this.onFatalError(error)
    } else if (this.isDestroyed === false) {
      const { isWriteAck, correlationId } = this.currentStep.message

      // // Delete values that should not be broadcast
      this.currentStep.message.isWriteAck = false
      delete this.currentStep.message.correlationId // TODO: Optimise
      this.recordHandler.broadcastUpdate(
          this.name,
          this.currentStep.message,
          false,
          this.currentStep.sender,
      )
      // Restore the message for other callers to use
      this.currentStep.message.isWriteAck = isWriteAck
      this.currentStep.message.correlationId = correlationId
      this.next()

    } else if (this.steps.length === 0 && this.pendingCacheWrites === 0 && this.pendingStorageWrites === 0) {
      this.destroy(null)
    }
  }

/**
 * Callback for responses returned by storage.set()
 */
  private onStorageSetResponse (error: string | null, socketWrapper?: SocketWrapper, message?: Message): void {
    if (message && socketWrapper) {
      this.handleWriteAcknowledgement(error, socketWrapper, message)
    }

    if (error) {
      this.onFatalError(error)
    } else if (
      this.steps.length === 0 && this.pendingCacheWrites === 0 && this.pendingStorageWrites === 0
    ) {
      this.destroy(null)
    }
  }

/**
 * Sends all write acknowledgement messages at the end of a transition
 */
  private sendWriteAcknowledgementErrors (errorMessage: string) {
    for (const [socketWrapper, pendingWrites] of this.writeAckSockets) {
      for (const correlationId in pendingWrites) {
        socketWrapper.sendMessage({
          topic: TOPIC.RECORD, action: RECORD_ACTION.RECORD_UPDATE_ERROR, reason: errorMessage, correlationId
        })
      }
    }
    this.writeAckSockets.clear()
  }

/**
 * Generic error callback. Will destroy the queue and notify the senders of all pending
 * transitions
 */
  private onFatalError (error: string): void {
    if (this.isDestroyed === true) {
      return
    }
    this.services.logger.error(RECORD_ACTION[RECORD_ACTION.RECORD_UPDATE_ERROR], error.toString(), this.metaData)

    for (let i = 0; i < this.steps.length; i++) {
      if (!this.steps[i].sender.isRemote) {
        this.steps[i].sender.sendMessage({
          topic: TOPIC.RECORD,
          action: RECORD_ACTION.RECORD_UPDATE_ERROR,
          name: this.steps[i].message.name
        })
      }
    }

    this.destroy(error)
  }

}
