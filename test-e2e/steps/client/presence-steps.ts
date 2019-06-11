import { defaultDelay } from '../../framework/utils'
import {When, Then, Given} from 'cucumber'
import { presence } from '../../framework/presence'

Given(/^(.+) subscribes to presence events$/, (clientExpression: string, done) => {
  presence.subscribe(clientExpression)
  setTimeout(done, defaultDelay)
})

Given(/^(.+) unsubscribes to presence events$/, (clientExpression: string, done) => {
  presence.unsubscribe(clientExpression)
  setTimeout(done, defaultDelay)
})

Given(/^(.+) subscribes to presence events for "([^"]*)"$/, (clientExpression: string, users: string, done) => {
  users.split(',').forEach((user) => presence.subscribe(clientExpression, user))
  setTimeout(done, defaultDelay * 3)
})

Given(/^(.+) unsubscribes to presence events for "([^"]*)"$/, (clientExpression: string, users: string, done) => {
  users.split(',').forEach((user) => presence.unsubscribe(clientExpression, user))
  setTimeout(done, defaultDelay)
})

When(/^(.+) queries for connected clients$/, (clientExpression: string, done) => {
  presence.getAll(clientExpression)
  setTimeout(done, defaultDelay)
})

When(/^(.+) queries for clients "([^"]*)"$/, (clientExpression: string, clients: string, done) => {
  presence.getAll(clientExpression, clients.split(','))
  setTimeout(done, defaultDelay)
})

Then(/^(.+) (?:is|are) (not )?notified that (.+) logged ([^"]*)$/, presence.assert.notifiedUserStateChanged)

Then(/^(.+) is notified that (?:clients|client) "([^"]*)" (?:are|is) connected$/, (clientExpression: string, connectedClients) => {
  presence.assert.globalQueryResult(clientExpression, null, connectedClients.split(','))
})

Then(/^(.+) receives a "([^"]*)" error on their query$/, (clientExpression: string, error) => {
  presence.assert.globalQueryResult(clientExpression, error)
})

Then(/^(.+) (?:is|are) notified that (?:clients|client) "([^"]*)" (?:are|is) online$/, (clientExpression: string, clients) => {
  presence.assert.queryResult(clientExpression, clients.split(','), true)
})

Then(/^(.+) (?:is|are) notified that (?:clients|client) "([^"]*)" (?:are|is) offline$/, (clientExpression: string, clients) => {
  presence.assert.queryResult(clientExpression, clients.split(','), false)
})

Then(/^(.+) is notified that no clients are connected$/, (clientExpression: string) => {
  presence.assert.globalQueryResult(clientExpression, null, [])
})
