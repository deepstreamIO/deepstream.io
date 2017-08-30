'use strict'

const utils = require('./utils')
const listening = require('../../framework/listening')

const cucumber = require('cucumber')
const When = cucumber.When
const Then = cucumber.Then
const Given = cucumber.Given

When(/^publisher (\S*) (accepts|rejects) (?:a|an) (event|record) match "([^"]*)" for pattern "([^"]*)"$/, (client, action, type, subscriptionName, pattern) => {
  listening.setupListenResponse(client, action === 'accepts', type, subscriptionName, pattern)
})

When(/^publisher (\S*) listens to (?:a|an) (event|record) with pattern "([^"]*)"$/, (client, type, pattern, done) => {
  listening.listens(client, type, pattern)
  setTimeout(done, utils.defaultDelay)
})

When(/^publisher (\S*) unlistens to the (event|record) pattern "([^"]*)"$/, (client, type, pattern, done) => {
  listening.unlistens(client, type, pattern)
  setTimeout(done, utils.defaultDelay)
})

Then(/^publisher (\S*) does not receive (?:a|an) (event|record) match "([^"]*)" for pattern "([^"]*)"$/, listening.assert.doesNotRecieveMatch)

Then(/^publisher (\S*) receives (\d+) (event|record) (?:match|matches) "([^"]*)" for pattern "([^"]*)"$/, listening.assert.recievesMatch)

Then(/^publisher (\S*) removed (\d+) (event|record) (?:match|matches) "([^"]*)" for pattern "([^"]*)"$/, listening.assert.recievedUnMatch)
