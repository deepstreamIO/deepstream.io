import { defaultDelay } from '../../framework/utils'
import {When, Then, Given} from 'cucumber'
import { rpc } from '../../framework/rpc'

Given(/^(.+) provides? the RPC "([^"]*)"$/, (clientExpression: string, rpcName, done) => {
  rpc.provide(clientExpression, rpcName)
  setTimeout(done, defaultDelay)
})

Given(/^(.+) unprovides? the RPC "([^"]*)"$/, (clientExpression: string, rpcName, done) => {
  rpc.unprovide(clientExpression, rpcName)
  setTimeout(done, defaultDelay)
})

When(/^(.+) calls? the RPC "([^"]*)" with arguments? ("[^"]*"|\d+|{.*})$/, (clientExpression: string, rpcName, args, done) => {
  rpc.make(clientExpression, rpcName, args)
  setTimeout(done, defaultDelay)
})

Then(/(.+) receives? a response for RPC "([^"]*)" with data ("[^"]*"|\d+|{.*})$/, rpc.assert.recievesResponse)

Then(/(.+) (eventually )?receives? a response for RPC "([^"]*)" with error "([^"]*)"$/, rpc.assert.recievesResponseWithError)

Then(/(.+) RPCs? "([^"]*)" (?:is|are) never called$/, (clientExpression: string, rpcName) => {
  rpc.assert.providerCalled(clientExpression, rpcName, 0)
})

Then(/(.+) RPCs? "([^"]*)" (?:is|are) called once( with data ("[^"]*"|\d+|{.*}))?$/, (clientExpression: string, rpcName, data) => {
  rpc.assert.providerCalled(clientExpression, rpcName, 1, data)
})

Then(/(.+) RPCs? "([^"]*)" is called (\d+) times$/, (clientExpression: string, rpcName, numTimes) => {
  rpc.assert.providerCalled(clientExpression, rpcName, numTimes)
})
