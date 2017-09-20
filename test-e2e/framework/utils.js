'use strict'

function parseData (data) {
  if (data === undefined || data === 'undefined') {
    return undefined
  } else if (data === 'null') {
    return null
  }
  try {
    return JSON.parse(data)
  } catch (e) {
    return data
  }
}

module.exports = {
  parseData
}
