import { defaultDelay } from '../../framework/utils'
import {When, Then, Given} from 'cucumber'
import { presence } from '../../framework/presence'

Given(/^(.+) subscribes to presence events$/, (clientExpression, done) => {
  presence.subscribe(clientExpression)
  setTimeout(done, defaultDelay)
})

Given(/^(.+) unsubscribes to presence events$/, (clientExpression, done) => {
  presence.unsubscribe(clientExpression)
  setTimeout(done, defaultDelay)
})

Given(/^(.+) subscribes to presence events for "([^"]*)"$/, (clientExpression, users, done) => {
  users.split(',').forEach((user) => presence.subscribe(clientExpression, user))
  setTimeout(done, defaultDelay)
})

Given(/^(.+) unsubscribes to presence events for "([^"]*)"$/, (clientExpression, users, done) => {
  users.split(',').forEach((user) => presence.unsubscribe(clientExpression, user))
  setTimeout(done, defaultDelay)
})

When(/^(.+) queries for connected clients$/, (clientExpression, done) => {
  presence.getAll(clientExpression)
  setTimeout(done, defaultDelay)
})

When(/^(.+) queries for clients "([^"]*)"$/, (clientExpression, clients, done) => {
  presence.getAll(clientExpression, clients.split(','))
  setTimeout(done, defaultDelay)
})

Then(/^(.+) (?:is|are) (not )?notified that (.+) logged ([^"]*)$/, presence.assert.notifiedUserStateChanged)

Then(/^(.+) is notified that (?:clients|client) "([^"]*)" (?:are|is) connected$/, (clientExpression, connectedClients) => {
  presence.assert.globalQueryResult(clientExpression, null, connectedClients.split(','))
})

Then(/^(.+) receives a "([^"]*)" error on their query$/, (clientExpression, error) => {
  presence.assert.globalQueryResult(clientExpression, error)
})

Then(/^(.+) (?:is|are) notified that (?:clients|client) "([^"]*)" (?:are|is) online$/, (clientExpression, clients) => {
  presence.assert.queryResult(clientExpression, clients.split(','), true)
})

Then(/^(.+) (?:is|are) notified that (?:clients|client) "([^"]*)" (?:are|is) offline$/, (clientExpression, clients) => {
  presence.assert.queryResult(clientExpression, clients.split(','), false)
})

Then(/^(.+) is notified that no clients are connected$/, (clientExpression) => {
  presence.assert.globalQueryResult(clientExpression, null, [])
})
