'use strict'

module.exports = class RuleCache {
  /**
   * This cache stores rules that are frequently used. It removes
   * unused rules after a preset interval
   *
   * @constructor
   * @param {Object} options deepstream options
   */
  constructor (options) {
    this._options = options
    this._data = {}
    this._interval = setInterval(this._purge.bind(this), options.cacheEvacuationInterval)
  }

  /**
   * Empties the rulecache completely
   *
   * @public
   * @returns {void}
   */
  reset () {
    this._data = {}
  }

  /**
   * Checks if an entry for a specific rule in a specific section is
   * present
   *
   * @param   {String}  section e.g. record, event or rpc
   * @param   {String}  name    the name of the record, event or rpc
   * @param   {String}  type    the type of the action, e.g. read, write, subscribe
   *
   * @public
   * @returns {Boolean}
   */
  has (section, name, type) {
    return !!this._data[toKey(section, name, type)]
  }

  /**
   * Resets the usage flag and returns an entry from the cache
   *
   * @param   {String}  section e.g. record, event or rpc
   * @param   {String}  name    the name of the record, event or rpc
   * @param   {String}  type    the type of the action, e.g. read, write, subscribe
   *
   * @public
   * @returns {Object} rule
   */
  get (section, name, type) {
    const key = toKey(section, name, type)
    this._data[key].isUsed = true
    return this._data[key].rule
  }


  /**
   * Adds an entry to the cache
   *
   * @param   {String}  section e.g. record, event or rpc
   * @param   {String}  name    the name of the record, event or rpc
   * @param   {String}  type    the type of the action, e.g. read, write, subscribe
   * @param   {Object}  rule the result of a rule lookup
   *
   * @public
   * @returns {Object} rule
   */
  set (section, name, type, rule) {
    this._data[toKey(section, name, type)] = {
      rule,
      isUsed: true
    }
  }

  /**
   * This method is called repeatedly on an interval, defined by
   * cacheEvacuationInterval.
   *
   * If a rule in the cache has been used in the last interval, it sets its isUsed flag to false.
   * Whenever the rule is used, the isUsed flag will be set to true
   * Any rules that haven't been used in the next cycle will be removed from the cache
   *
   * @private
   * @returns {void}
   */
  _purge () {
    for (const key in this._data) {
      if (this._data[key].isUsed === true) {
        this._data[key].isUsed = false
      } else {
        delete this._data[key]
      }
    }
  }

}

/**
 * Creates a key from the various set parameters
 *
 * @param   {String}  section e.g. record, event or rpc
 * @param   {String}  name    the name of the record, event or rpc
 * @param   {String}  type    the type of the action, e.g. read, write, subscribe
 *
 * @public
 * @returns {String} key
 */
function toKey (section, name, type) {
  return `${section}_${name}_${type}`
}
