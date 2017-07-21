'use strict'

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

/**
 * Returns a unique identifier
 *
 * @returns {String} uid
 */
function getUid () {
  return `${Date.now().toString(36)}-${(Math.random() * 10000000000000000000).toString(36)}`
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
function reverseMap (map) {
  const reversedMap = {}

  for (const key in map) {
    reversedMap[map[key]] = key
  }

  return reversedMap
}

module.exports = {
  deepFreeze,
  getUid,
  reverseMap
}
