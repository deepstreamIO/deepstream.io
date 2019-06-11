import { defaultDelay } from '../../framework/utils'
import {When, Then, Given} from 'cucumber'
import { client } from '../../framework/client'

Then(/^(.+) receives? at least one "([^"]*)" error "([^"]*)"$/, client.recievedErrorOnce)
Then(/^(.+) receives? "([^"]*)" error "([^"]*)"$/, client.recievedOneError)
Then(/^(.+) received? no errors$/, client.recievedNoErrors)

Given(/^(.+) logs? out$/, (clientExpression: string, done) => {
  client.logsOut(clientExpression, () => {})
  setTimeout(done, defaultDelay)
})

Given(/^(.+) connects? to server (\d+)$/, client.connect)

Then(/^(.+) connections? times? out$/, client.connectionTimesOut)

// Then(/^(.+) has connection state "([^"]*)"$/, (clientExpression: string, state) =>
//   client.hasConnectionState(clientExpression: string, state))

Then(/^(.+) had a connection state change to "([^"]*)"$/, (clientExpression: string, state) =>
  client.hadConnectionState(clientExpression, true, state))

Then(/^(.+) did not have a connection state change to "([^"]*)"$/, (clientExpression: string, state) =>
  client.hadConnectionState(clientExpression, false, state))

Given(/^(.+) connects? and logs? into server (\d+)$/, (clientExpression: string, server, done) => {
  client.connectAndLogin(clientExpression, server, () => {
    setTimeout(done, defaultDelay)
  })
})

Given(/^(.+) logs? in with username "([^"]*)" and password "([^"]*)"$/, (clientExpression: string, username, password, done) => {
  client.login(clientExpression, username, password, () => {
    setTimeout(done, defaultDelay)
  })
})

When(/^(.+) attempts? to login with username "([^"]*)" and password "([^"]*)"$/, client.attemptLogin)

Then(/^(.+) (?:is|are) notified of too many login attempts$/, client.recievedTooManyLoginAttempts)

Then(/^(.+) receives? no login response$/, (clientExpression) => {
  client.recievesNoLoginResponse(clientExpression)
})

Then(/^(.+) receives? an (un)?authenticated login response(?: with data ({.*}))?$/, (clientExpression: string, unauth, data) => {
  client.recievesLoginResponse(clientExpression, unauth, data)
})

Then(/^(.+) "([^"]*)" callback was( not)? called( once)?( with ({.*}))?$/, (clientExpression: string, eventName, notCalled, once, data) => {
  client.callbackCalled(clientExpression, eventName, notCalled, once, data)
})
