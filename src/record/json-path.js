'use strict'
/* eslint-disable no-param-reassign */
const SPLIT_REG_EXP = /[.[\]]/g

/**
 * This class allows to set or get specific
 * values within a json data structure using
 * string-based paths
 *
 * @param {String} path A path, e.g. users[2].firstname
 *
 * @constructor
 */
const JsonPath = function (path) {
  this._path = path
  this._tokens = []
  this._tokenize()
}

/**
 * Sets the value of the path. If the path (or parts
 * of it) doesn't exist yet, it will be created
 *
 * @param {Object} node
 * @param {Mixed} value
 *
 * @public
 * @returns {void}
 */
JsonPath.prototype.setValue = function (node, value) {
  let i = 0
  const tokensLen = (this._tokens === undefined) ? 0 : this._tokens.length
  let traverser = node
  let parent = node
  let token = undefined

  // validate start state first
  if (node === undefined || tokensLen === 0) {
    return
  }

  // traverse root obj (node)
  // create path nodes of the proper type (array|object) where necessary
  for (i = 0; i < tokensLen; i++) {
    token = this._tokens[i]
    parent = traverser

    const isLastPathToken = (i === (tokensLen - 1))
    const isArrayToken = (token.indexOf('=') >= 0)
    const nextToken = isLastPathToken ? undefined : this._tokens[i + 1]
    const isNextTokenArrayToken = isLastPathToken ? undefined : (nextToken.indexOf('=') >= 0)
    let elem = undefined

    if (isArrayToken) {
      const idx = token.split('=')[1] * 1
      elem = traverser[idx]
      if (!isLastPathToken) {
        if (isNextTokenArrayToken) {
          if (elem === undefined || !(elem instanceof Array)) {
            traverser[idx] = []
          }
        } else if (elem === undefined || !(elem instanceof Object)) {
          traverser[idx] = {}
        }
        elem = traverser[idx]
      } else {
        token = idx
      }
    } else if (traverser[token] !== undefined) {
      elem = traverser[token]
    } else if (!isLastPathToken && isNextTokenArrayToken) {
      traverser[token] = []
      elem = traverser[token]
    } else {
      traverser[token] = {}
      elem = traverser[token]
    }
    parent = traverser
    traverser = elem
  }

  // assign value to path target
  if (parent !== undefined && token !== undefined) {
    parent[token] = value
  }

}

/**
 * Parses the path. Splits it into
 * keys for objects and indices for arrays.
 *
 * @private
 * @returns {void}
 */
JsonPath.prototype._tokenize = function () {

  // makes json path array items a single 'part' value of parts below
  // 'arrayProp[#]' members transform to 'arrayProp=#' now instead of 'arrayProp.#' previously
  // see setValue fnc above for special handling of array item parsing vs numeric obj member name
  // e.g. 'object.1' parsing. this allows for support of parsing and differentiating object
  // member names that are also numeric values
  // also supports multi-dimensional arrays e.g. arr[0][1][2][3]... => arr.=0.=1.=2.=3...
  // note: array index tokens are prefixed from regex with a '=' e.g. .=0.=1.=2 compared with
  // numeric obj field names tokens which are just .0.1.2.3
  let str = this._path.replace(/\s/g, '')
  str = str.replace(/\[(.*?)\]/g, '.=$1')
  const parts = str.split(SPLIT_REG_EXP)
  let part
  let i

  for (i = 0; i < parts.length; i++) {
    part = parts[i].trim()

    if (part === undefined || part.length === 0) {
      continue
    }

    this._tokens.push(part)
  }
}

module.exports = JsonPath
