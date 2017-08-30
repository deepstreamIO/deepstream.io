'use strict'

/**
 * The unique registry is responsible for maintaing a single source of truth
 * within the Server
 *
 */
module.exports = class LockRegistry {
  /**
  * The unique registry is a singleton and is only created once
  * within deepstream.io. It is passed via
  * via the options object.
  *
  * @param  {Object} options                     The options deepstream was created with
  * @constructor
  */
  constructor (options) {
    this._options = options
    this._locks = {}
  }

  /**
  * Requests a lock, if the leader ( whether local or distributed ) has the lock availble
  * it will invoke the callback with true, otherwise false.
  *
  * @param  {String}   name     the lock name that is desired
  * @param  {Function} callback the callback to be told if the lock has been reserved succesfully
  *
  * @public
  * @returns {void}
  */
  get (name, callback) {
    callback(this._getLock(name))
  }

  /**
  * Release a lock, allowing other resources to request it again
  *
  * @param  {String}   name     the lock name that is desired
  *
  * @public
  * @returns {void}
  */
  release (name) {
    this._releaseLock(name)
  }

  /**
  * Returns true if reserving lock was possible otherwise returns false
  *
  * @param  {String}   name     Name of lock
  *
  * @private
  * @return {boolean}
  */
  _getLock (name) {
    if (this._locks[name] === true) {
      return false
    }
    this._locks[name] = true
    return true
  }

  /**
  * Called when a lock is no longer required and can be released.
  * @param  {String} name Lock name
  *
  * @private
  * @returns {void}
  */
  _releaseLock (name) {
    delete this._locks[name]
  }
}
