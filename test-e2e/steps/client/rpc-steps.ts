import { defaultDelay } from '../../framework/utils'
import {When, Then, Given} from 'cucumber'
import { rpc } from '../../framework/rpc'

Given(/^(.+) provides? the RPC "([^"]*)"$/, (clientExpression, rpcName, done) => {
  rpc.provide(clientExpression, rpcName)
  setTimeout(done, defaultDelay)
})

Given(/^(.+) unprovides? the RPC "([^"]*)"$/, (clientExpression, rpcName, done) => {
  rpc.unprovide(clientExpression, rpcName)
  setTimeout(done, defaultDelay)
})

When(/^(.+) calls? the RPC "([^"]*)" with arguments? ("[^"]*"|\d+|\{.*\})$/, (clientExpression, rpcName, args, done) => {
  rpc.make(clientExpression, rpcName, args)
  setTimeout(done, defaultDelay * 2)
})

Then(/(.+) receives? a response for RPC "([^"]*)" with data ("[^"]*"|\d+|\{.*\})$/, rpc.assert.recievesResponse)

Then(/(.+) (eventually )?receives? a response for RPC "([^"]*)" with error "([^"]*)"$/, rpc.assert.recievesResponseWithError)

Then(/(.+) RPCs? "([^"]*)" (?:is|are) never called$/, (clientExpression, rpcName) => {
  rpc.assert.providerCalled(clientExpression, rpcName, 0)
})

Then(/(.+) RPCs? "([^"]*)" (?:is|are) called once( with data ("[^"]*"|\d+|\{.*\}))?$/, (clientExpression, rpcName, data) => {
  rpc.assert.providerCalled(clientExpression, rpcName, 1, data)
})

Then(/(.+) RPCs? "([^"]*)" is called (\d+) times$/, (clientExpression, rpcName, numTimes) => {
  rpc.assert.providerCalled(clientExpression, rpcName, numTimes)
})
