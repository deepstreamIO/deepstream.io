'use strict'

const sinon = require('sinon')

const utils = require('./utils')

const cucumber = require('cucumber')
const When = cucumber.When
const Then = cucumber.Then
const Given = cucumber.Given

const rpc = require('../../framework/rpc')

Given(/^(.+) provides? the RPC "([^"]*)"$/, (clientExpression, rpcName, done) => {
  rpc.provide(clientExpression, rpcName)
  setTimeout(done, utils.defaultDelay)
})

Given(/^(.+) unprovides? the RPC "([^"]*)"$/, (clientExpression, rpcName, done) => {
  rpc.unprovide(clientExpression, rpcName)
  setTimeout(done, utils.defaultDelay)
})

When(/^(.+) calls? the RPC "([^"]*)" with arguments? ("[^"]*"|\d+|\{.*\})$/, (clientExpression, rpcName, args, done) => {
  rpc.make(clientExpression, rpcName, args, () => {
    setTimeout(done, utils.defaultDelay)
  })
})

Then(/(.+) receives? a response for RPC "([^"]*)" with data ("[^"]*"|\d+|\{.*\})$/, rpc.assert.recievesResponse)

Then(/(.+) (eventually )?receives? a response for RPC "([^"]*)" with error "([^"]*)"$/, rpc.assert.recievesResponseWithError)

Then(/(.+) RPCs? "([^"]*)" (?:is|are) never called$/, (clientExpression, rpcName) => {
  rpc.assert.providerCalled(clientExpression, rpcName, 0)
})

Then(/(.+) RPCs? "([^"]*)" (?:is|are) called once$/, (clientExpression, rpcName) => {
  rpc.assert.providerCalled(clientExpression, rpcName, 1)
})

Then(/(.+) RPCs? "([^"]*)" is called (\d+) times$/, rpc.assert.providerCalled)

