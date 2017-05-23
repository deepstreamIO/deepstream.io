'use strict'

const C = require('../constants/constants')
const JsonPath = require('./json-path')
const RecordRequest = require('./record-request')
const messageParser = require('../message/message-parser')
const messageBuilder = require('../message/message-builder')
const utils = require('../utils/utils')

/**
 * This class manages one or more simultanious updates to the data of a record.
 * But: Why does that need to be so complicated and why does this class even exist?
 *
 * In short: Cross-network concurrency. If your record is written to by a single datasource
 * and consumed by many clients, this class is admittably overkill, but if deepstream is used to
 * build an app that allows many users to collaboratively edit the same dataset, sooner or later
 * two of them will do so at the same time and clash.
 *
 * Every deepstream record therefor has a version number that's incremented with every change.
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
 *
 * @param {String} name the name of the record that the transition will be applied to
 * @param {Object} deepstream options
 * @param {RecordHandler} recordHandler the instance of recordHandler that created this transition
 *
 * @constructor
 */
const RecordTransition = function (name, options, recordHandler) {
  this._name = name
  this._options = options
  this._recordHandler = recordHandler
  this._steps = []
  this._record = null
  this._currentStep = null
  this._recordRequest = null
  this._sendVersionExists = []
  this.isDestroyed = false
  this._pendingUpdates = {}
  this._ending = false
  this._storageResponses = 0
  this._cacheResponses = 0
  this._lastVersion = null
  this._lastError = null

  this._onCacheResponse = this._onCacheResponse.bind(this)
  this._onStorageResponse = this._onStorageResponse.bind(this)
  this._onRecord = this._onStorageResponse.bind(this)
  this._onFatalError = this._onFatalError.bind(this)
}

/**
 * Checks if a specific version number is already processed or
 * queued for processing
 *
 * @param   {Number}  version
 *
 * @returns {Boolean} hasVersion
 */
RecordTransition.prototype.hasVersion = function (version) {
  return version !== -1 && version <= this._lastVersion
}

/**
 * Send version exists error if the record has been already loaded, else
 * store the version exists error to send to the sockerWrapper once the
 * record is loaded
 *
 * @param   {SocketWrapper} socketWrapper the sender
 * @param   {Number} version The version number
 *
 * @public
 */
RecordTransition.prototype.sendVersionExists = function (step) {
  const socketWrapper = step.sender
  const version = step.version
  const config = step.message.data[4]

  if (this._record) {
    const data = config === undefined
    ? [this._name, this._record._v, JSON.stringify(this._record._d)]
    : [this._name, this._record._v, JSON.stringify(this._record._d), config]
    socketWrapper.sendError(C.TOPIC.RECORD, C.EVENT.VERSION_EXISTS, data)

    const msg = `${socketWrapper.user} tried to update record ${this._name} to version ${version} but it already was ${this._record._v}`
    this._options.logger.log(C.LOG_LEVEL.WARN, C.EVENT.VERSION_EXISTS, msg)
  } else {
    this._sendVersionExists.push({
      version,
      sender: socketWrapper,
      config,
      message: step.message
    })
  }
}

/**
 * Adds a new step (either an update or a patch) to the record. The step
 * will be queued or executed immediatly if the queue is empty
 *
 * This method will also retrieve the current record's data when called
 * for the first time
 *
 * @param {SocketWrapper} socketWrapper that send the message
 * @param {Number} version the expected version that this update will apply
 * @param {Object} message parsed deepstream message. Data will still be stringified JSON
 *
 * @public
 * @returns {void}
 */
RecordTransition.prototype.add = function (socketWrapper, version, message) {
  const update = {
    message,
    version,
    sender: socketWrapper
  }

  const valid = this._applyConfigAndData(socketWrapper, message, update)
  if (!valid) {
    socketWrapper.sendError(C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
    return
  }

  if (message.action === C.ACTIONS.UPDATE) {
    if (message.data.length !== 4 && message.data.length !== 3) {
      socketWrapper.sendError(C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
      return
    }

    if (!utils.isOfType(update.data, 'object')) {
      socketWrapper.sendError(C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
      return
    }

    update.isPatch = false
  }

  if (message.action === C.ACTIONS.PATCH) {
    if (message.data.length !== 5 && message.data.length !== 4) {
      socketWrapper.sendError(C.TOPIC.RECORD, C.EVENT.INVALID_MESSAGE_DATA, message.raw)
      return
    }

    update.isPatch = true
    update.path = message.data[2]
  }

  if (this._lastVersion !== null && this._lastVersion !== version - 1) {
    this.sendVersionExists(update)
    return
  }

  if (version !== -1) {
    this._lastVersion = version
  }
  this._cacheResponses++
  this._steps.push(update)

  if (this._recordRequest === null) {
    this._recordRequest = new RecordRequest(
      this._name,
      this._options,
      socketWrapper,
      this._onRecord,
      this._onFatalError
    )
  } else if (this._steps.length === 1 && this._cacheResponses === 1) {
    this._next()
  }
}

RecordTransition.prototype._applyConfigAndData = function (socketWrapper, message, step) {
  try {
    const config = RecordTransition._getRecordConfig(message)
    this._applyConfig(config, step)
    if (message.action === C.ACTIONS.UPDATE) {
      step.data = JSON.parse(message.data[2])
    } else {
      step.data = messageParser.convertTyped(message.data[3])
    }
  } catch (e) {
    return false
  }
  return true
}

/**
 * Destroys the instance
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype.destroy = function (errorMessage) {
  if (this.isDestroyed) {
    return
  }

  this._sendWriteAcknowledgements(errorMessage || this._writeError)
  this._recordHandler._$transitionComplete(this._name)
  this.isDestroyed = true
  this._options = null
  this._name = null
  this._record = null
  this._recordHandler = null
  this._steps = null
  this._currentStep = null
  this._recordRequest = null
  this._pendingUpdates = null
  this._lastVersion = null
  this._cacheResponses = 0
  this._storageResponses = 0
}

/**
 * Tries to apply config given from a socketWrapper on an
 * incoming message
 *
 * @param {Object} step the current step of the transition
 * @param {String} message
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._applyConfig = function (config, step) {
  if (!config) {
    return
  }

  if (config.writeSuccess) {
    if (this._pendingUpdates[step.sender.uuid] === undefined) {
      this._pendingUpdates[step.sender.uuid] = {
        socketWrapper: step.sender,
        versions: [step.version]
      }
    } else {
      const update = this._pendingUpdates[step.sender.uuid]
      update.versions.push(step.version)
    }
  }
}

/**
 * Gets the config from an incoming Record message
 *
 * @param   {String} message
 *
 * @private
 * @throws {SyntaxError } If config not valid
 * @returns null or the given config
 */
RecordTransition._getRecordConfig = function (message) {
  let config
  if (message.action === C.ACTIONS.PATCH && message.data.length === 5) {
    config = message.data[4]
  } else if (message.action === C.ACTIONS.UPDATE && message.data.length === 4) {
    config = message.data[3]
  }

  if (!config) {
    return null
  }

  return JSON.parse(config)
}

/**
 * Callback for successfully retrieved records
 *
 * @param   {Object} record
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onRecord = function (step, record) {
  if (record === null) {
    this._onFatalError(`Received update for non-existant record ${this._name}`)
  } else {
    this._record = record
    this._flushVersionExists()
    this._next()
  }
}

/**
 * Once the record is loaded this method is called recoursively
 * for every step in the queue of pending updates.
 *
 * It will apply every patch or update and - once done - either
 * call itself to process the next one or destroy the RecordTransition
 * of the queue has been drained
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._next = function () {
  if (this.isDestroyed === true) {
    return
  }

  if (this._steps.length === 0) {
    if (this._cacheResponses === 0 && this._storageResponses === 0) {
      this.destroy()
    }
    return
  }

  this._currentStep = this._steps.shift()
  if (this._currentStep.version === -1) {
    const message = this._currentStep.message
    const version = this._record._v + 1
    this._currentStep.version = message.data[1] = version
  }

  if (this._record._v !== this._currentStep.version - 1) {
    this._cacheResponses--
    this.sendVersionExists(this._currentStep)
    this._next()
    return
  }

  this._record._v = this._currentStep.version

  if (this._currentStep.isPatch) {
    (new JsonPath(this._currentStep.path)).setValue(this._record._d, this._currentStep.data)
  } else {
    this._record._d = this._currentStep.data
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
  if (!this._options.storageExclusion || !this._options.storageExclusion.test(this._name)) {
    this._storageResponses++
    this._options.storage.set(
      this._name,
      this._record,
      this._onStorageResponse
    )
  }
  this._options.cache.set(
    this._name,
    this._record,
    this._onCacheResponse
  )
}

/**
 * Send all the stored version exists errors once the record has been loaded.
 *
 * @private
 */
RecordTransition.prototype._flushVersionExists = function () {
  for (let i = 0; i < this._sendVersionExists.length; i++) {
    const conflict = this._sendVersionExists[i]
    this.sendVersionExists(conflict)
  }
  this._sendVersionExists = []
}

/**
 * Callback for responses returned by cache.set(). If an error
 * is returned the queue will be destroyed, otherwise
 * the update will be broadcast to other subscribers and the
 * next step invoked
 *
 * @param   {String} error
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onCacheResponse = function (a, b) {
  console.log('_onCacheResponse', a, b)
  this._cacheResponses--
  this._writeError = this._writeError || error
  if (error) {
    this._onFatalError(error)
  } else if (this.isDestroyed === false) {
    this._recordHandler._$broadcastUpdate(
      this._name,
      this._currentStep.message,
      false,
      this._currentStep.sender
    )
    this._next()
  } else if (
      this._cacheResponses === 0 &&
      this._storageResponses === 0 &&
      this._steps.length === 0
    ) {
    this.destroy()
  }
}

/**
 * Callback for responses returned by storage.set()
 *
 * @param   {String} error
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onStorageResponse = function (a, b) {
  console.log('_onStorageResponse', a, b)
  this._storageResponses--
  this._writeError = this._writeError || error
  if (error) {
    this._onFatalError(error)
  } else if (
      this._cacheResponses === 0 &&
      this._storageResponses === 0 &&
      this._steps.length === 0
    ) {
    this.destroy()
  }
}

/**
 * Sends all write acknowledgement messages at the end of a transition
 *
 * @param   {String} error any error message that occurred while storing the
 *                         record data
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._sendWriteAcknowledgements = function (errorMessage) {
  errorMessage = errorMessage === undefined ? null : errorMessage // eslint-disable-line
  for (const uid in this._pendingUpdates) {
    const update = this._pendingUpdates[uid]

    update.socketWrapper.sendMessage(C.TOPIC.RECORD, C.ACTIONS.WRITE_ACKNOWLEDGEMENT, [
      this._name,
      update.versions,
      messageBuilder.typed(errorMessage)
    ])
  }
}

/**
 * Generic error callback. Will destroy the queue and notify the senders of all pending
 * transitions
 *
 * @param   {String} errorMessage
 *
 * @private
 * @returns {void}
 */
RecordTransition.prototype._onFatalError = function (errorMessage) {
  if (this.isDestroyed === true) {
    /* istanbul ignore next */
    return
  }
  this._options.logger.log(C.LOG_LEVEL.ERROR, C.EVENT.RECORD_UPDATE_ERROR, errorMessage)

  for (let i = 0; i < this._steps.length; i++) {
    if (this._steps[i].sender !== C.SOURCE_MESSAGE_CONNECTOR) {
      this._steps[i].sender.sendError(
        C.TOPIC.RECORD,
        C.EVENT.RECORD_UPDATE_ERROR,
        this._steps[i].version
      )
    }
  }

  if (this._cacheResponses === 0 && this._storageResponses === 0) {
    this.destroy(errorMessage)
  }
}

module.exports = RecordTransition
