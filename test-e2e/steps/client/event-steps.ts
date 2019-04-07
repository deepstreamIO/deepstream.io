import { defaultDelay } from '../../framework/utils'
import {When, Then, Given} from 'cucumber'
import { event } from '../../framework/event'

When(/^(.+) publishes? (?:an|the) event "([^"]*)"(?: with data ("[^"]*"|\d+|{.*}))?$/, (clientExpression, subscriptionName, data, done) => {
  event.publishes(clientExpression, subscriptionName, data)
  setTimeout(done, defaultDelay)
})

Then(/^(.+) receives? (the|no) event "([^"]*)"(?: with data (.+))?$/, (clientExpression, theNo, subscriptionName, data) => {
  event.assert.recieved(clientExpression, !theNo.match(/^no$/), subscriptionName, data)
})

Given(/^(.+) subscribes? to (?:an|the) event "([^"]*)"$/, (clientExpression, subscriptionName, done) => {
  event.subscribes(clientExpression, subscriptionName)
  setTimeout(done, defaultDelay)
})

When(/^(.+) unsubscribes from (?:an|the) event "([^"]*)"$/, (clientExpression, subscriptionName, done) => {
  event.unsubscribes(clientExpression, subscriptionName)
  setTimeout(done, defaultDelay)
})
