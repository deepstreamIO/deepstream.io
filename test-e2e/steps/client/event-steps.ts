import { defaultDelay } from '../../framework/utils'
import {When, Then, Given} from 'cucumber'
const { event } = require(`../../framework${process.env.V3 ? '-v3' : ''}/event`)

When(/^(.+) publishes? (?:an|the) event "([^"]*)"(?: with data ("[^"]*"|\d+|{.*}))?$/, (clientExpression: string, subscriptionName, data, done) => {
  event.publishes(clientExpression, subscriptionName, data)
  setTimeout(done, defaultDelay)
})

Then(/^(.+) receives? (the|no) event "([^"]*)"(?: with data (.+))?$/, (clientExpression: string, theNo, subscriptionName, data) => {
  event.assert.received(clientExpression, !theNo.match(/^no$/), subscriptionName, data)
})

Given(/^(.+) subscribes? to (?:an|the) event "([^"]*)"$/, (clientExpression: string, subscriptionName, done) => {
  event.subscribes(clientExpression, subscriptionName)
  setTimeout(done, defaultDelay * 10)
})

When(/^(.+) unsubscribes from (?:an|the) event "([^"]*)"$/, (clientExpression: string, subscriptionName, done) => {
  event.unsubscribes(clientExpression, subscriptionName)
  setTimeout(done, defaultDelay)
})
