const url = require('url')
const OBJECT = 'object'

exports.getUid = function () {
  return Date.now().toString(36) + '-' + (Math.random() * 10000000000000000000).toString(36)
}

exports.splitRev = function (s) {
  if (!s) {
    return []
  }
  const i = s.indexOf('-')
  return [ s.slice(0, i), s.slice(i + 1) ]
}

exports.compareVersions = function (a, b) {
  if (!a) {
    return false
  }
  if (!b) {
    return true
  }
  const [av, ar] = exports.splitRev(a)
  const [bv, br] = exports.splitRev(b)
  return parseInt(av, 10) > parseInt(bv, 10) || (av === bv && ar >= br)
}

exports.combineEvents = function (emitters, event, callback) {
  let count = 0
  const increment = function () {
    count++
    if (count === emitters.length) {
      callback()
    }
  }

  for (let i = 0; i < emitters.length; i++) {
    emitters[i].once(event, increment)
  }
}

exports.reverseMap = function (map) {
  let reversedMap = {}

  for (let key in map) {
    reversedMap[map[key]] = key
  }

  return reversedMap
}

exports.isOfType = function (input, expectedType) {
  if (expectedType === 'array') {
    return Array.isArray(input)
  } else if (expectedType === 'url') {
    return !!url.parse(input).host
  } else {
    return typeof input === expectedType
  }
}

exports.validateMap = function (map, throwError, schema) {
  let error
  for (let key in schema) {
    if (typeof map[ key ] === 'undefined') {
      error = new Error('Missing key ' + key)
      break
    }

    if (!exports.isOfType(map[ key ], schema[ key ])) {
      error = new Error('Invalid type ' + typeof map[ key ] + ' for ' + key)
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

exports.deepCopy = function (obj) {
  if (typeof obj === OBJECT) {
    return JSON.parse(JSON.stringify(obj))
  } else {
    return obj
  }
}

exports.merge = function () {
  const result = {}
  const objs = Array.prototype.slice.apply(arguments)

  const _merge = (objA, objB) => {
    for (let key in objB) {
      if (objB[ key ] && objB[ key ].constructor === Object) {
        objA[ key ] = objA[ key ] || {}
        _merge(objA[ key ], objB[ key ])
      } else if (objB[ key ] !== undefined) {
        objA[ key ] = objB[ key ]
      }
    }
  }

  for (let i = 0; i < objs.length; i++) {
    _merge(result, objs[ i ])
  }

  return result
}

exports.setTimeout = function (callback, timeoutDuration) {
  if (timeoutDuration !== null) {
    return setTimeout(callback, timeoutDuration)
  } else {
    return -1
  }
}

exports.setInterval = function (callback, intervalDuration) {
  if (intervalDuration !== null) {
    return setInterval(callback, intervalDuration)
  } else {
    return -1
  }
}

exports.getRandomIntInRange = function (min, max) {
  return min + Math.floor(Math.random() * (max - min))
}

exports.spliceRandomElement = function (array) {
  const randomIndex = exports.getRandomIntInRange(0, array.length)
  return array.splice(randomIndex, 1)[ 0 ]
}

exports.JSONParse = function (text, reviver) {
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
