'use strict'

const noop = function () {}

exports.type = 'no message connector specified'
exports.subscribe = noop
exports.publish = noop
exports.unsubscribe = noop
exports.isReady = true
