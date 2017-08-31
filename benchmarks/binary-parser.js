'use strict'

const messageHandler = require('../src/cluster/messaging/message-handler')
const assert = require('assert')

const fs = require('fs')

const data = fs.readFileSync('./test-data.bin')
const Benchmark = require('benchmark')

const suite = new Benchmark('parser', () => {
  let readBuffer = data
  let result
  do {
    result = messageHandler.tryParseBinaryMsg(readBuffer, err => console.log('parse error', err))
    if (result.bytesConsumed > 0) {
      // this._onMessage(result.message)
      readBuffer = readBuffer.slice(result.bytesConsumed)
    }
  } while (readBuffer.length !== 0 && result.bytesConsumed !== 0)
  assert(readBuffer.length === 0)
}, {
  maxTime: 10,
  onComplete () {
    console.log(`The mean run time after ${this.count} iterations was ${
      this.stats.mean * 1000} ± ${this.stats.deviation * 1000} ms`)
    console.log(`Variance ${this.stats.variance.toExponential(9)}`)
  },
  onError (err) {
    console.error('an error occurred', err)
    throw err
  },
  onAbort (err) {
    console.error('an abort occurred', err)
    throw err
  }
})
suite.run()
