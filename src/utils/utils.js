'use strict'
/* eslint-disable valid-typeof */
const url = require('url')

const OBJECT = 'object'

/**
 * Returns a unique identifier
 *
 * @returns {String} uid
 */
exports.getUid = function () {
  return `${Date.now().toString(36)}-${(Math.random() * 10000000000000000000).toString(36)}`
}

/**
 * Calls <callback> once all <emitters> have emitted <event>
 *
 * @param {Array} emitters Array of objects extending events.EventEmitter
 * @param {String} event
 * @param {Function} callback Will be called once every emitter has emitted the event
 *
 * @public
 * @returns {void}
 */
exports.combineEvents = function (emitters, event, callback) {
  let i
  let count = 0
  const increment = function () {
    count++

    if (count === emitters.length) {
      callback()
    }
  }

  for (i = 0; i < emitters.length; i++) {
    emitters[i].once(event, increment)
  }
}

/**
 * Takes a key-value map and returns
 * a map with { value: key } of the old map
 *
 * @param  {Object} map
 *
 * @public
 * @return {Object} reversed map
 */
exports.reverseMap = function (map) {
  const reversedMap = {}

  for (const key in map) {
    reversedMap[map[key]] = key
  }

  return reversedMap
}

/**
 * Extended version of the typeof operator. Also supports 'array'
 * and 'url' to check for valid URL schemas
 *
 * @param   {Mixed}   input
 * @param   {String}  expectedType
 *
 * @public
 * @returns {Boolean}
 */
exports.isOfType = function (input, expectedType) {
  if (input === null) {
    return expectedType === 'null'
  } else if (expectedType === 'array') {
    return Array.isArray(input)
  } else if (expectedType === 'url') {
    return !!url.parse(input).host
  }
  return typeof input === expectedType
}

/**
 * Takes a map and validates it against a basic
 * json schema in the form { key: type }
 *
 * @param   {Object}  map        the map to validate
 * @param   {Boolean} throwError if true, errors will be thrown rather than returned
 * @param   {Object}  schema     json schema in the form { key: type }
 *
 * @public
 * @returns {Boolean|Error}
 */
exports.validateMap = function (map, throwError, schema) {
  let error
  let key

  for (key in schema) {
    if (typeof map[key] === 'undefined') {
      error = new Error(`Missing key ${key}`)
      break
    }

    if (!exports.isOfType(map[key], schema[key])) {
      error = new Error(`Invalid type ${typeof map[key]} for ${key}`)
      break
    }
  }

  if (error) {
    if (throwError) {
      throw error
    } else {
      return error
    }
  } else {
    return true
  }
}

/**
 * Tests have shown that JSON stringify outperforms any attempt of
 * a code based implementation by 50% - 100% whilst also handling edge-cases and keeping
 * implementation complexity low.
 *
 * If ES6/7 ever decides to implement deep copying natively (what happened to Object.clone?
 * that was briefly a thing...), let's switch it for the native implementation. For now though,
 * even Object.assign({}, obj) only provides a shallow copy.
 *
 * Please find performance test results backing these statements here:
 *
 * http://jsperf.com/object-deep-copy-assign
 *
 * @param   {Mixed} obj the object that should be cloned
 *
 * @public
 * @returns {Mixed} clone
 */
exports.deepCopy = function (obj) {
  if (typeof obj === OBJECT) {
    return JSON.parse(JSON.stringify(obj))
  }
  return obj
}

/**
 * Multi Object recoursive merge
 *
 * @param {Object} multiple objects to be merged into each other recoursively
 *
 * @public
 * @returns {Object} merged result
 */
exports.merge = function () {
  const result = {}
  const objs = Array.prototype.slice.apply(arguments) // eslint-disable-line
  let i

  const _merge = (objA, objB) => {
    let key

    for (key in objB) {
      if (objB[key] && objB[key].constructor === Object) {
        objA[key] = objA[key] || {}
        _merge(objA[key], objB[key])
      } else if (objB[key] !== undefined) {
        objA[key] = objB[key]
      }
    }
  }

  for (i = 0; i < objs.length; i++) {
    _merge(result, objs[i])
  }

  return result
}

/**
 * Set timeout utility that adds support for disabling a timeout
 * by passing null
 *
 * @param {Function} callback        the function that will be called after the given time
 * @param {Number}   timeoutDuration the duration of the timeout in milliseconds
 *
 * @public
 * @returns {Number} timeoutId
 */
exports.setTimeout = function (callback, timeoutDuration) {
  if (timeoutDuration !== null) {
    return setTimeout(callback, timeoutDuration)
  }
  return -1
}

/**
 * Set Interval utility that adds support for disabling an interval
 * by passing null
 *
 * @param {Function} callback        the function that will be called after the given time
 * @param {Number}   intervalDuration the duration of the interval in milliseconds
 *
 * @public
 * @returns {Number} intervalId
 */
exports.setInterval = function (callback, intervalDuration) {
  if (intervalDuration !== null) {
    return setInterval(callback, intervalDuration)
  }
  return -1
}

exports.getRandomIntInRange = function (min, max) {
  return min + Math.floor(Math.random() * (max - min))
}

exports.spliceRandomElement = function (array) {
  const randomIndex = exports.getRandomIntInRange(0, array.length)
  return array.splice(randomIndex, 1)[0]
}

/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 *
 * @param  {Array} array The array to shuffle
 */
exports.shuffleArray = function (array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

/**
 * This method tries to parse a value, and returns
 * an object containing the value or error.
 *
 * This is an optimization to avoid doing try/catch
 * inline since it incurs a massive performance hit
 * in most versions of node.
 */
exports.parseJSON = function (text, reviver) {
  try {
    return {
      value: JSON.parse(text, reviver)
    }
  } catch (err) {
    return {
      error: err
    }
  }
}

/*
 * Recursively freeze a deeply nested object
 * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
 */
function deepFreeze (obj) {

  // Retrieve the property names defined on obj
  const propNames = Object.getOwnPropertyNames(obj)

  // Freeze properties before freezing self
  propNames.forEach((name) => {
    const prop = obj[name]

    // Freeze prop if it is an object
    if (typeof prop === 'object' && prop !== null) {
      deepFreeze(prop)
    }
  })

  // Freeze self (no-op if already frozen)
  return Object.freeze(obj)
}

exports.deepFreeze = deepFreeze
