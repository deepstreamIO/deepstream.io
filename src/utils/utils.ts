/* eslint-disable valid-typeof */
import * as url from 'url';
import { EventEmitter } from 'events'

/**
 * Returns a unique identifier
 */
export let getUid = function (): string {
  return `${Date.now().toString(36)}-${(Math.random() * 10000000000000000000).toString(36)}`
}

/**
 * Calls <callback> once all <emitters> have emitted <event>
 */
export let combineEvents = function (emitters: Array<EventEmitter>, event: string, callback: Function): void {
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
 */
export let reverseMap = function (map: Object): object {
  const reversedMap = {}

  for (const key in map) {
    reversedMap[map[key]] = key
  }

  return reversedMap
}

/**
 * Extended version of the typeof operator. Also supports 'array'
 * and 'url' to check for valid URL schemas
 */
export let isOfType = function (input: any, expectedType: string): boolean {
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
 * @returns {Boolean|Error}
 */
export let validateMap = function (map: object, throwError: boolean, schema: Object): any {
  let error
  let key

  for (key in schema) {
    if (typeof map[key] === 'undefined') {
      error = new Error(`Missing key ${key}`)
      break
    }

    if (!isOfType(map[key], schema[key])) {
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
 * Multi Object recoursive merge
 * @param {Object} multiple objects to be merged into each other recoursively
 */
export let merge = function (...args) {
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
 */
export let setTimeout = function (callback: Function, timeoutDuration: number): any {
  if (timeoutDuration !== null) {
    return setTimeout(callback, timeoutDuration)
  }
  return -1
}

/**
 * Set Interval utility that adds support for disabling an interval
 * by passing null
 */
export let setInterval = function (callback: Function, intervalDuration: number): any {
  if (intervalDuration !== null) {
    return setInterval(callback, intervalDuration)
  }
  return -1
}

export let getRandomIntInRange = function (min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min))
}

export let spliceRandomElement = function (array: Array<any>): any {
  const randomIndex = getRandomIntInRange(0, array.length)
  return array.splice(randomIndex, 1)[0]
}

/**
 * Randomize array element order in-place.
 * Using Durstenfeld shuffle algorithm.
 */
export let shuffleArray = function (array: Array<any>): Array<any> {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = array[i]
    array[i] = array[j]
    array[j] = temp
  }
  return array
}

/*
 * Recursively freeze a deeply nested object
 * https://developer.mozilla.org/en/docs/Web/JavaScript/Reference/Global_Objects/Object/freeze
 */
export let deepFreeze = function (obj: object): object {

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
