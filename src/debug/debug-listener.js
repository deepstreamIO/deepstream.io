'use strict'

this._data = {}

/**
 * Listen record which you receive from clients.
 *
 * @param {String} pattern The pattern to match records which you receive from clients.
 * @param {Callback} callback callback of parameter recordName and recordData.
 *
 * @public
 * @returns {void}
 */
const listenRecord = function (pattern, callback) {
  setInterval(function () {
      if (this._data != null) {
          if (this._data.message.data[0].match(pattern)) {
              callback(this._data.message.data[0], this._data.data)
          }
          this._data = null
      }
  }, 1)
}

/**
 * Fetch data from record
 *
 * @returns {void}
 */
const enter = function (data) {
  this._data = data
}

exports.listenRecord = listenRecord
exports.enter = enter
