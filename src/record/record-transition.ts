import { RECORD_ACTIONS, TOPIC } from '../constants'
import { isOfType } from '../utils/utils'
import { setValue as setPathValue } from './json-path'
import RecordHandler from './record-handler'
import recordRequest from './record-request'

interface Step {
  message: RecordWriteMessage
  sender: SocketWrapper
}

export default class RecordTransition {
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
 public isDestroyed: boolean

 private metaData: any
 private name: string
 private config: DeepstreamConfig
 private services: DeepstreamServices
 private recordHandler: RecordHandler
 private steps: Array<Step>
 private record: StorageRecord | null
 private currentStep: Step
 private recordRequestMade: boolean
 private existingVersions: Array<Step>
 private pendingUpdates: any
 private ending: boolean
 private storageResponses: number
 private cacheResponses: number
 private lastVersion: number | null
 private lastError: string | null
 private writeError: Error

  constructor (name: string, config: DeepstreamConfig, services: DeepstreamServices, recordHandler: RecordHandler, metaData) {
    this.metaData = metaData
    this.name = name
    this.config = config
    this.services = services
    this.recordHandler = recordHandler
    this.steps = []
    this.recordRequestMade = false

    this.record = null
    // this.currentStep = null
    this.lastVersion = null
    this.lastError = null

    this.existingVersions = []
    this.isDestroyed = false
    this.pendingUpdates = {}
    this.ending = false
    this.storageResponses = 0
    this.cacheResponses = 0

    this.onCacheResponse = this.onCacheResponse.bind(this)
    this.onStorageResponse = this.onStorageResponse.bind(this)
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
    if (this.record) {
      socketWrapper.sendError({
        topic: TOPIC.RECORD,
        action: step.message.action,
        name: this.name,
        version: this.record._v,
        parsedData: this.record._d,
        isWriteAck: step.message.isWriteAck,
      }, RECORD_ACTIONS.VERSION_EXISTS)

      this.services.logger.warn(
        RECORD_ACTIONS.VERSION_EXISTS,
        `${socketWrapper.user} tried to update record ${this.name} to version ${step.message.version} but it already was ${this.record._v}`,
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
  public add (socketWrapper: SocketWrapper, message: RecordWriteMessage, upsert: boolean): void {
    const version = message.version
    const update = {
      message,
      sender: socketWrapper,
    }
    const valid = this.applyConfigAndData(socketWrapper, message, update)
    if (!valid) {
      socketWrapper.sendError(message, RECORD_ACTIONS.INVALID_MESSAGE_DATA)
      return
    }

    if (message.action === RECORD_ACTIONS.UPDATE) {
      if (!isOfType(message.parsedData, 'object') && !isOfType(message.parsedData, 'array')) {
        socketWrapper.sendError(message, RECORD_ACTIONS.INVALID_MESSAGE_DATA)
        return
      }
    }

    if (this.lastVersion !== null && this.lastVersion !== version - 1) {
      this.sendVersionExists(update)
      return
    }

    if (version !== -1) {
      this.lastVersion = version
    }
    this.cacheResponses++
    this.steps.push(update)

    if (this.recordRequestMade === false) {
      this.recordRequestMade = true
      recordRequest(
        this.name,
        this.config,
        this.services,
        socketWrapper,
        (record) => this.onRecord(record, upsert),
        this.onCacheResponse,
        this,
        this.metaData,
      )
    } else if (this.steps.length === 1 && this.cacheResponses === 1) {
      this.next()
    }
  }

/**
 * Validates and assigns config and data to the step object. Because
 * JSON parsing is expensive we want to push these to the lowest level
 * of execution.
 */
  private applyConfigAndData (socketWrapper: SocketWrapper, message: RecordWriteMessage, step: Step): boolean {
    const result = socketWrapper.parseData(message)
    if (result instanceof Error) {
      console.error(result, message)
      return false
    }
    if (message.isWriteAck) {
      if (this.pendingUpdates[step.sender.uuid] === undefined) {
        this.pendingUpdates[step.sender.uuid] = {
          socketWrapper: step.sender,
          versions: [step.message.version],
        }
      } else {
        const update = this.pendingUpdates[step.sender.uuid]
        update.versions.push(step.message.version)
      }
    }
    return true

  }

/**
 * Destroys the instance
 */
  private destroy (errorMessage: Error | null): void {
    if (this.isDestroyed) {
      return
    }

    this.sendWriteAcknowledgements(errorMessage || this.writeError)
    this.recordHandler.transitionComplete(this.name)
    this.isDestroyed = true

    // this.options = null
    // this.name = null
    // this.record = null
    // this.recordHandler = null
    // this.steps = null
    // this.currentStep = null
    // this.recordRequest = null
    // this.lastVersion = null

    // this.pendingUpdates = null
    // this.cacheResponses = 0
    // this.storageResponses = 0
  }

/**
 * Callback for successfully retrieved records
 */
  private onRecord (record: StorageRecord, upsert: boolean) {
    if (record === null) {
      if (!upsert) {
        this.onFatalError(new Error(`Received update for non-existant record ${this.name}`))
        return
      }
      this.record = { _v: 0, _d: {} }
    } else {
      this.record = record
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

    if (this.record === null) {
      return
    }

    const currentStep = this.steps.shift()
    if (!currentStep) {
      if (this.cacheResponses === 0 && this.storageResponses === 0) {
        this.destroy(null)
      } else {
        console.error('this shouldnt reach here')
      }
      return
    }

    this.currentStep = currentStep
    let message = currentStep.message

    if (message.version === -1) {
      message = Object.assign({}, message, { version: this.record._v + 1 })
      currentStep.message = message
    }

    if (this.record._v !== message.version - 1) {
      this.cacheResponses--
      this.sendVersionExists(currentStep)
      this.next()
      return
    }

    this.record._v = message.version

    if (message.path) {
      setPathValue(this.record._d, message.path, message.parsedData)
    } else {
      this.record._d = message.parsedData
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
    if (!this.config.storageExclusion || !this.config.storageExclusion.test(this.name)) {
      this.storageResponses++
      this.services.storage.set(
      this.name,
      this.record,
      this.onStorageResponse,
      this.metaData,
    )
    }
    this.services.cache.set(
      this.name,
      this.record,
      this.onCacheResponse,
      this.metaData,
    )
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

/**
 * Callback for responses returned by cache.set(). If an error
 * is returned the queue will be destroyed, otherwise
 * the update will be broadcast to other subscribers and the
 * next step invoked
 */
  private onCacheResponse (error: Error | null): void {
    this.cacheResponses--
    this.writeError = this.writeError || error
    if (error) {
      this.onFatalError(error)
    } else if (this.isDestroyed === false) {
      this.recordHandler.broadcastUpdate(
        this.name,
        this.currentStep.message,
        false,
        this.currentStep.sender,
      )
      this.next()
    } else if (
      this.cacheResponses === 0 &&
      this.storageResponses === 0 &&
      this.steps.length === 0
    ) {
      this.destroy(null)
    }
  }

/**
 * Callback for responses returned by storage.set()
 */
  private onStorageResponse (error: Error | null): void {
    this.storageResponses--
    this.writeError = this.writeError || error
    if (error) {
      this.onFatalError(error)
    } else if (
      this.cacheResponses === 0 &&
      this.storageResponses === 0 &&
      this.steps.length === 0
    ) {
      this.destroy(null)
    }
  }

/**
 * Sends all write acknowledgement messages at the end of a transition
 */
  private sendWriteAcknowledgements (errorMessage: Error | null) {
    for (const uid in this.pendingUpdates) {
      const update = this.pendingUpdates[uid]
      update.socketWrapper.sendMessage({
        topic: TOPIC.RECORD,
        action: RECORD_ACTIONS.WRITE_ACKNOWLEDGEMENT,
        name: this.name,
        parsedData: [
          update.versions,
          errorMessage ? errorMessage.toString() : null,
        ],
      }, true)
    }
  }

/**
 * Generic error callback. Will destroy the queue and notify the senders of all pending
 * transitions
 */
  private onFatalError (errorMessage: Error): void {
    if (this.isDestroyed === true) {
      return
    }
    this.services.logger.error(RECORD_ACTIONS[RECORD_ACTIONS.RECORD_UPDATE_ERROR], errorMessage.toString(), this.metaData)

    for (let i = 0; i < this.steps.length; i++) {
      if (!this.steps[i].sender.isRemote) {
        this.steps[i].sender.sendError(this.steps[i].message, RECORD_ACTIONS.RECORD_UPDATE_ERROR)
      }
    }

    if (this.cacheResponses === 0 && this.storageResponses === 0) {
      this.destroy(errorMessage)
    }
  }

}
