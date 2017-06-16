'use strict'
/* eslint-disable */
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
function setValue(node, path, value) {
  const tokens = tokenize(path)

  let i
  for (i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]
    if (node[token] !== undefined) {
      node = node[token]
    } else if (tokens[i + 1] && !isNaN(tokens[i + 1])) {
      node = node[token] = []
    } else {
      node = node[token] = {}
    }
  }

  node[tokens[i]] = value
}

/**
 * Parses the path. Splits it into
 * keys for objects and indices for arrays.
 *
 * @private
 * @returns {void}
 */
function tokenize (path) {
  const tokens = []
  const parts = path.split(SPLIT_REG_EXP)

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()

    if (part.length === 0) {
      continue
    }

    if (!isNaN(part)) {
      tokens.push(parseInt(part, 10))
      continue
    }

    tokens.push(part)
  }

  return tokens
}

module.exports = {
  setValue
}
