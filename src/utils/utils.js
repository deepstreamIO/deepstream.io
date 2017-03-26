'use strict'

const xuid = require('xuid')

exports.getUid = function () {
  return xuid()
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
