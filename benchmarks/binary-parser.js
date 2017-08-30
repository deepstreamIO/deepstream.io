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
    const { mean, variance, deviation } = this.stats
    const { count } = this
    console.log(`The mean run time after ${count} iterations was ${
      mean * 1000} ± ${deviation * 1000} ms`)
    console.log(`Variance ${variance.toExponential(9)}`)
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
