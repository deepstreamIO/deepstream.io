'use strict'

const utils = require('./utils')

const cucumber = require('cucumber')
const When = cucumber.When
const Then = cucumber.Then
const Given = cucumber.Given

const client = require('../../framework/client')

Then(/^(.+) receives? at least one "([^"]*)" error "([^"]*)"$/, client.recievedErrorOnce)
Then(/^(.+) receives? "([^"]*)" error "([^"]*)"$/, client.recievedOneError)
Then(/^(.+) received? no errors$/, client.recievedNoErrors)

Given(/^(.+) logs? out$/, (clientExpression, done) => {
  client.logsOut(clientExpression, () => {})
  setTimeout(done, utils.defaultDelay)
})

Given(/^(.+) connects? to server (\d+)$/, client.connect)

Then(/^(.+) connections? times? out$/, client.connectionTimesOut)

Then(/^(.+) had a connection state change to "([^"]*)"$/, (clientExpression, state) =>
  client.hadConnectionState(clientExpression, true, state))
Then(/^(.+) did not have a connection state change to "([^"]*)"$/, (clientExpression, state) =>
  client.hadConnectionState(clientExpression, false, state))

Given(/^(.+) connects? and logs? into server (\d+)$/, (clientExpression, server, done) => {
  client.connectAndLogin(clientExpression, server, () => {
    setTimeout(done, utils.defaultDelay)
  })
})

Given(/^(.+) logs? in with username "([^"]*)" and password "([^"]*)"$/, (clientExpression, username, password, done) => {
  client.login(clientExpression, username, password, () => {
    setTimeout(done, utils.defaultDelay)
  })
})

When(/^(.+) attempts? to login with username "([^"]*)" and password "([^"]*)"$/, client.attemptLogin)

Then(/^(.+) (?:is|are) notified of too many login attempts$/, client.recievedTooManyLoginAttempts)

Then(/^(.+) receives? no login response$/, (clientExpression) => {
  client.recievesNoLoginResponse(clientExpression)
})

Then(/^(.+) receives? an (un)?authenticated login response(?: with data (\{.*\}))?$/, (clientExpression, unauth, data) => {
  client.recievesLoginResponse(clientExpression, unauth, data)
})
