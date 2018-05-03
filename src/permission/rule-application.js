'use strict'
/* eslint-disable consistent-return */
const OPEN = 'open'
const UNDEFINED = 'undefined'
const LOADING = 'loading'
const ERROR = 'error'
const STRING = 'string'
const EOL = require('os').EOL

const C = require('../constants/constants')
const recordRequest = require('../record/record-request')
const messageParser = require('../message/message-parser')
const jsonPath = require('../record/json-path')

module.exports = class RuleApplication {
  /**
   * This class handles the evaluation of a single rule. It creates
   * the required variables, injects them into the rule function and
   * runs the function recoursively until either all cross-references,
   * references to old or new data is loaded, it errors or the maxIterationCount
   * limit is exceeded
   *
   * @constructor
   *
   * @param {Object} params requires the following keys
   *
   * username: <String>,
   * authData: <Object>,
   * path: <Object>,
   * ruleSpecification: <Object>,
   * message: <Object>,
   * action: <String>,
   * regexp: <RegExp>,
   * rule: <Object>,
   * name: <String>,
   * callback: <Function>,
   * options: <Object>
   */
  constructor (params) {
    this._params = params
    this._isDestroyed = false
    this._runScheduled = false
    this._maxIterationCount = this._params.permissionOptions.maxRuleIterations
    this._run = this._run.bind(this)
    this._crossReferenceFn = this._crossReference.bind(this)
    this._createNewRecordRequest = this._createNewRecordRequest.bind(this)
    this._pathVars = this._getPathVars()
    this._user = this._getUser()
    this._recordData = {}
    this._id = Math.random().toString()
    this._iterations = 0
    this._run()
  }

  /**
   * Runs the rule function. This method is initially called when this class
   * is constructed and recoursively from thereon whenever the loading of a record
   * is completed
   *
   * @private
   * @returns {void}
   */
  _run () {
    this._runScheduled = false
    this._iterations++
    /* istanbul ignore next */
    if (this._isDestroyed === true) {
      return
    }

    if (this._iterations > this._maxIterationCount) {
      this._onRuleError('Exceeded max iteration count')
      return
    }

    const args = this._getArguments()
    let result

    if (this._isDestroyed === true) {
      return
    }

    try {
      result = this._params.rule.fn.apply({}, args)
    } catch (error) {
      if (this._isReady()) {
        this._onRuleError(error)
        return
      }
    }

    if (this._isReady()) {
      this._params.callback(null, result)
      this._destroy()
    }
  }

  /**
   * Callback if a rule has irrecoverably errored. Rule errors due to unresolved
   * crossreferences are allowed as long as a loading step is in progress
   *
   * @param   {Error|String} error
   *
   * @private
   * @returns {void}
   */
  _onRuleError (error) {
    if (this._isDestroyed === true) {
      return
    }
    const errorMsg = `error when executing ${this._params.rule.fn.toString()}${EOL
             }for ${this._params.path}: ${error.toString()}`
    this._params.logger.warn(C.EVENT.MESSAGE_PERMISSION_ERROR, errorMsg)
    this._params.callback(C.EVENT.MESSAGE_PERMISSION_ERROR, false)
    this._destroy()
  }

  /**
   * Called either asynchronously when data is successfully retrieved from the
   * cache or synchronously if its already present
   *
   * @param   {String} recordName the name of the loaded record data
   * @param   {Object} data       the data of the record
   *
   * @private
   * @returns {void}
   */
  _onLoadComplete (data, recordName) {
    this._recordData[recordName] = data
    if (this._isReady()) {
      this._runScheduled = true
      process.nextTick(this._run)
    }
  }

  /**
   * Called whenever a storage or cache retrieval fails. Any kind of error during the
   * permission process is treated as a denied permission
   *
   * @param   {String} recordName
   * @param   {Error}  error
   *
   * @private
   * @returns {void}
   */
  _onLoadError (error, message, recordName) {
    this._recordData[recordName] = ERROR
    const errorMsg = `failed to load record ${this._params.name} for permissioning:${error.toString()}`
    this._params.logger.error(C.EVENT.RECORD_LOAD_ERROR, errorMsg)
    this._params.callback(C.EVENT.RECORD_LOAD_ERROR, false)
    this._destroy()
  }

  /**
   * Destroys this class and nulls down values to avoid
   * memory leaks
   *
   * @private
   * @returns {void}
   */
  _destroy () {
    this._params.recordHandler.removeRecordRequest(this._params.name)
    this._isDestroyed = true
    this._runScheduled = false
    this._params = null
    this._crossReferenceFn = null
    this._pathVars = null
    this._user = null
    this._recordData = null
    this._currentData = null
  }

  /**
   * If data.someValue is used in the rule, this method retrieves or loads the
   * current data. This can mean different things, depending on the type of message
   *
   * the data arguments is supported for record read & write,
   * event publish and rpc request
   *
   * for event publish, record update and rpc request, the data is already provided
   * in the message and doesn't need to be loaded
   *
   * for record.patch, only a delta is part of the message. For the full data, the current value
   * is loaded and the patch applied on top
   *
   * @private
   * @returns {void}
   */
  _getCurrentData () {
    if (this._params.rule.hasData === false) {
      return null
    }

    const msg = this._params.message
    let data

    if (msg.topic === C.TOPIC.EVENT && msg.data[1]) {
      data = messageParser.convertTyped(msg.data[1])
    } else if (msg.topic === C.TOPIC.RPC) {
      data = messageParser.convertTyped(msg.data[2])
    } else if (msg.topic === C.TOPIC.RECORD && msg.action === C.ACTIONS.UPDATE) {
      data = getRecordUpdateData(msg)
    } else if (msg.topic === C.TOPIC.RECORD && msg.action === C.ACTIONS.PATCH) {
      data = this._getRecordPatchData(msg)
    }

    if (data instanceof Error) {
      this._onRuleError(`error when converting message data ${data.toString()}`)
    } else {
      return data
    }
  }

  /**
   * Loads the records current data and applies the patch data onto it
   * to avoid users having to distuinguish between patches and updates
   *
   * @param   {Object} msg a deepstream message
   *
   * @private
   * @returns {Object} recordData
   */
  _getRecordPatchData (msg) {
    if (msg.data.length !== 4 || typeof msg.data[2] !== STRING) {
      return new Error('Invalid message data')
    }

    const currentData = this._recordData[this._params.name]
    const newData = messageParser.convertTyped(msg.data[3])
    let data

    if (newData instanceof Error) {
      return newData
    }

    if (currentData === null) {
      return new Error(`Tried to apply patch to non-existant record ${msg.data[0]}`)
    }

    if (typeof currentData !== UNDEFINED && currentData !== LOADING) {
      data = JSON.parse(JSON.stringify(currentData._d))
      jsonPath.setValue(data, msg.data[2], newData)
      return data
    }
    this._loadRecord(this._params.name)
  }

  /**
   * Returns or loads the record's previous value. Only supported for record
   * write and read operations
   *
   * If getData encounters an error, the rule application might already be destroyed
   * at this point
   *
   * @private
   * @returns {void}
   */
  _getOldData () {
    if (this._isDestroyed === true ||
      this._params.rule.hasOldData === false ||
      this._recordData[this._params.name] === null
    ) {
      return null
    } else if (this._recordData[this._params.name]) {
      return this._recordData[this._params.name]._d
    }
    this._loadRecord(this._params.name)
  }

  /**
   * Compile the list of arguments that will be injected
   * into the permission function. This method is called
   * everytime the permission is run. This allows it to merge
   * patches and update the now timestamp
   *
   * @private
   * @returns {void}
   */
  _getArguments () {
    return [
      this._crossReferenceFn,
      this._user,
      this._getCurrentData(),
      this._getOldData(),
      Date.now(),
      this._params ? this._params.action : null
    ].concat(this._pathVars)
  }

  /**
   * Returns the data for the user variable. This is only done once
   * per rule as the user is not expected to change
   *
   * @private
   * @returns {void}
   */
  _getUser () {
    return {
      isAuthenticated: this._params.username !== OPEN,
      id: this._params.username,
      data: this._params.authData
    }
  }

  /**
   * Applies the compiled regexp for the path and extracts
   * the variables that will be made available as $variableName
   * within the rule
   *
   * This is only done once per rule as the path is not expected
   * to change
   *
   * @private
   * @returns {Array} pathVars
   */
  _getPathVars () {
    return this._params.name.match(this._params.regexp).slice(1)
  }

  /**
   * Returns true if all loading operations that are in progress have finished
   * and no run has been scheduled yet
   *
   * @private
   * @returns {Boolean}
   */
  _isReady () {
    let isLoading = false

    for (const key in this._recordData) {
      if (this._recordData[key] === LOADING) {
        isLoading = true
      }
    }

    return isLoading === false && this._runScheduled === false
  }

  /**
   * Loads a record with a given name. This will either result in
   * a onLoadComplete or onLoadError call. This method should only
   * be called if the record is not already being loaded or present,
   * but I'll leave the additional safeguards in until absolutely sure.
   *
   * @param   {String} recordName
   *
   * @private
   * @returns {void}
   */
  _loadRecord (recordName) {
    /* istanbul ignore next */
    if (this._recordData[recordName] === LOADING) {
      return
    }
    /* istanbul ignore next */
    if (typeof this._recordData[recordName] !== UNDEFINED) {
      this._onLoadComplete(recordName, this._recordData[recordName])
      return
    }

    this._recordData[recordName] = LOADING

    this._params.recordHandler.runWhenRecordStable(
      recordName,
      this._createNewRecordRequest
    )
  }

  /**
   * Load the record data from the cache for permissioning. This method should be
   * called once the record is stable – meaning there are no remaining writes
   * waiting to be written to the cache.
   *
   * @param   {String} recordName
   *
   * @private
   * @returns {void}
   */
  _createNewRecordRequest (recordName) {
    recordRequest(
      recordName,
      this._params.options,
      null,
      this._onLoadComplete,
      this._onLoadError,
      this
    )
  }

  /**
   * This method is passed to the rule function as _ to allow crossReferencing
   * of other records. Cross-references can be nested, leading to this method
   * being recoursively called until the either all cross references are loaded
   * or the rule has finally failed
   *
   * @param   {String} recordName
   *
   * @private
   * @returns {void}
   */
  _crossReference (recordName) {
    const type = typeof recordName

    if (type !== UNDEFINED && type !== STRING) {
      this._onRuleError(`crossreference got unsupported type ${type}`)
    } else if (type === UNDEFINED || recordName.indexOf(UNDEFINED) !== -1) {
      return
    } else if (this._recordData[recordName] === LOADING) {
      return
    } else if (this._recordData[recordName] === null) {
      return null
    } else if (typeof this._recordData[recordName] === UNDEFINED) {
      this._loadRecord(recordName)
    } else {
      return this._recordData[recordName]._d
    }
  }
}

  /**
   * Extracts the data from record update messages
   *
   * @param   {Object} msg a deepstream message
   *
   * @private
   * @returns {Object} recordData
   */
function getRecordUpdateData (msg) {
  let data

  try {
    data = JSON.parse(msg.data[2])
  } catch (error) {
    return error
  }

  return data
}
