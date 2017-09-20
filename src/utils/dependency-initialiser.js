'use strict'

const C = require('../constants/constants')

const EventEmitter = require('events').EventEmitter

module.exports = class DependencyInitialiser extends EventEmitter {
/**
 * This class is used to track the initialisation of
 * an individual dependency (cache connector, persistance connector,
 * message connector, logger)
 *
 * @param {Object} options deepstream options
 * @param {String} name    the key of the dependency within the options
 *
 * @constructor
 */
  constructor (deepstream, options, dependency, name) {
    super()
    this.isReady = false

    this._options = options
    this._dependency = dependency
    this._name = name
    this._timeout = null

    if (typeof this._dependency.on !== 'function' && typeof this._dependency.isReady === 'undefined') {
      const errorMessage = `${this._name} needs to implement isReady or be an emitter`
      this._options.logger.error(C.EVENT.PLUGIN_INITIALIZATION_ERROR, errorMessage)
      const error = new Error(errorMessage)
      error.code = 'PLUGIN_INITIALIZATION_ERROR'
      throw error
    }

    if (this._dependency.setDeepstream instanceof Function) {
      this._dependency.setDeepstream(deepstream)
    }

    if (this._dependency.isReady) {
      this._onReady()
    } else {
      this._timeout = setTimeout(
      this._onTimeout.bind(this),
      this._options.dependencyInitialisationTimeout
    )
      this._dependency.once('ready', this._onReady.bind(this))
      this._dependency.on('error', this._onError.bind(this))

      if (this._dependency.init) {
        this._dependency.init()
      }
    }
  }

/**
 * Returns the underlying dependency (e.g. the Logger, StorageConnector etc.)
 *
 * @public
 * @returns {Dependency}
 */
  getDependency () {
    return this._dependency
  }

/**
 * Callback for succesfully initialised dependencies
 *
 * @private
 * @returns {void}
 */
  _onReady () {
    if (this._timeout) {
      clearTimeout(this._timeout)
    }

    this._dependency.type = this._dependency.description || this._dependency.type
    const dependencyType = this._dependency.type ? `: ${this._dependency.type}` : ': no dependency description provided'
    this._options.logger.info(C.EVENT.INFO, `${this._name} ready${dependencyType}`)

    process.nextTick(this._emitReady.bind(this))
  }

/**
 * Callback for dependencies that weren't initialised in time
 *
 * @private
 * @returns {void}
 */
  _onTimeout () {
    const message = `${this._name} wasn't initialised in time`
    this._logError(message)
    const error = new Error(message)
    error.code = C.EVENT.PLUGIN_INITIALIZATION_TIMEOUT
    throw error
  }

/**
* Handles errors emitted by the dependency at startup.
*
* Plugin errors that occur at runtime are handled by the deepstream.io main class
*
* @param {Error|String} error
*
* @private
* @returns {void}
*/
  _onError (error) {
    if (this.isReady !== true) {
      this._logError(`Error while initialising ${this._name}: ${error.toString()}`)
      error.code = C.EVENT.PLUGIN_INITIALIZATION_ERROR
      throw error
    }
  }

/**
 * Emits the ready event after a one tick delay
 *
 * @private
 * @returns {void}
 */
  _emitReady () {
    this.isReady = true
    this.emit('ready')
  }

/**
 * Logs error messages
 *
 * Since the logger is a dependency in its own right, it can't be relied upon
 * here. If it is available, it will be used, otherwise the error will be logged
 * straight to the console
 *
 * @param   {String} message the error message
 *
 * @private
 * @returns {void}
 */
  _logError (message) {
    if (this._options.logger && this._options.logger.isReady) {
      this._options.logger.error(C.EVENT.PLUGIN_ERROR, message)
    } else {
      console.error('Error while initialising dependency')
      console.error(message)
    }
  }

}

