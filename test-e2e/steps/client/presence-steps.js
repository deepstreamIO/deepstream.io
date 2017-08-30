'use strict'

const sinon = require('sinon')
const utils = require('./utils')

const cucumber = require('cucumber')
const When = cucumber.When
const Then = cucumber.Then
const Given = cucumber.Given

const presence = require('../../framework/presence')

Given(/^(.+) subscribes to presence events$/, (clientExpression, done) => {
  presence.subscribe(clientExpression)
  setTimeout(done, utils.defaultDelay)
})

Given(/^(.+) subscribes to presence events for "([^"]*)"$/, (clientExpression, users, done) => {
  users.split(',').forEach(user => presence.subscribe(clientExpression, user))
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) queries for connected clients$/, (clientExpression, done) => {
  presence.getAll(clientExpression)
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) queries for clients "([^"]*)"$/, (clientExpression, clients, done) => {
  presence.getAll(clientExpression, clients.split(','))
  setTimeout(done, utils.defaultDelay)
})

Then(/^(.+) (?:is|are) notified that (.+) logged ([^"]*)$/, presence.assert.notifiedUserStateChanged)

Then(/^(.+) is notified that (?:clients|client) "([^"]*)" (?:are|is) connected$/, (clientExpression, connectedClients) => {
  presence.assert.globalQueryResult(clientExpression, connectedClients.split(','))
})

Then(/^(.+) (?:is|are) notified that (?:clients|client) "([^"]*)" (?:are|is) online$/, (clientExpression, clients) => {
  presence.assert.queryResult(clientExpression, clients.split(','), true)
})

Then(/^(.+) (?:is|are) notified that (?:clients|client) "([^"]*)" (?:are|is) offline$/, (clientExpression, clients) => {
  presence.assert.queryResult(clientExpression, clients.split(','), false)
})

Then(/^(.+) is notified that no clients are connected$/, (clientExpression) => {
  presence.assert.globalQueryResult(clientExpression, [])
})

