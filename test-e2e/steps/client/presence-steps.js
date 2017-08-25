'use strict'

const sinon = require('sinon')
const utils = require('./utils')

const { When, Then, Given } = require('cucumber')

const presence = require('../../framework/presence')

Given(/^(.+) subscribes to presence events$/, (clientExpression, done) => {
  presence.subscribe(clientExpression)
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) queries for connected clients$/, (clientExpression, done) => {
  presence.getAll(clientExpression)
  setTimeout(done, utils.defaultDelay)
})

Then(/^(.+) (?:is|are) notified that (.+) logged ([^"]*)$/, presence.assert.notifiedUserStateChanged)

Then(/^(.+) is notified that (?:clients|client) "([^"]*)" (?:are|is) connected$/, (clientExpression, connectedClients) => {
  presence.assert.queryResult(clientExpression, connectedClients.split(','))
})

Then(/^(.+) is notified that no clients are connected$/, (clientExpression) => {
  presence.assert.queryResult(clientExpression, [])
})

