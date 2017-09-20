'use strict'

const sinon = require('sinon')

const utils = require('./utils')

const cucumber = require('cucumber')
const When = cucumber.When
const Then = cucumber.Then
const Given = cucumber.Given

const event = require('../../framework/event')

When(/^(.+) publishes? (?:an|the) event "([^"]*)"(?: with data ("[^"]*"|\d+|\{.*\}))?$/, (clientExpression, subscriptionName, data, done) => {
  event.publishes(clientExpression, subscriptionName, data)
  setTimeout(done, utils.defaultDelay)
})

Then(/^(.+) receives? (the|no) event "([^"]*)"(?: with data (.+))?$/, (clientExpression, theNo, subscriptionName, data) => {
  event.recieved(clientExpression, !theNo.match(/^no$/), subscriptionName, data)
})

Given(/^(.+) subscribes? to (?:an|the) event "([^"]*)"$/, (clientExpression, subscriptionName, done) => {
  event.subscribes(clientExpression, subscriptionName)
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) unsubscribes from (?:an|the) event "([^"]*)"$/, (clientExpression, subscriptionName, done) => {
  event.unsubscribes(clientExpression, subscriptionName)
  setTimeout(done, utils.defaultDelay)
})
