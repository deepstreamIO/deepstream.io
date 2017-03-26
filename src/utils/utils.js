'use strict'

const url = require('url')
const xuid = require('xuid')

exports.getUid = function () {
  return xuid()
}

exports.isOfType = function (input, expectedType) {
  if (input === null) {
    return expectedType === 'null'
  } else if (expectedType === 'array') {
    return Array.isArray(input)
  } else if (expectedType === 'url') {
    return !!url.parse(input).host
  } else {
    return typeof input === expectedType // eslint-disable-line
  }
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
