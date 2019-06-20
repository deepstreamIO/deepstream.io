import {Given, When, Before, BeforeAll } from 'cucumber'
import { PromiseDelay } from '../../../src/utils/utils'
import { E2EHarness } from '../../tools/e2e-harness'

Before(async (scenarioResult) => {
  await global.cluster.updatePermissions('open')
})

Given(/"([^"]*)" permissions are used$/, async (permissionType) => {
  await global.cluster.updatePermissions(permissionType)
})

When(/^server (\S)* goes down$/, async (server) => {
  if (global.cluster.started === false) {
    return
  }
  await global.cluster.stopServer(server)
})

When(/^all servers go down$/, async () => {
  if (global.cluster.started === false) {
    return
  }
  await global.cluster.stop()
  await PromiseDelay(200)
})

When(/^server (\S)* comes back up$/, async (server) => {
  if (global.cluster.started) {
    return
  }
  await global.cluster.startServer(server)
})

When(/^all servers come back up$/, async () => {
  if (global.cluster.started === true) {
    return
  }
  await global.cluster.start()
  await PromiseDelay(200)
})

Given(/^a small amount of time passes$/, (done) => {
  setTimeout(done, 500)
})

BeforeAll(async () => {
  global.cluster = new E2EHarness([6001, 7001, 8001], process.env.ENABLE_LOGGING === 'true')
  await global.cluster.start()
  await PromiseDelay(200)
})

// AfterAll((callback) => {
//   setTimeout(() => {
//     global.cluster.once('stopped', () => {
//       callback()
//     })
//     global.cluster.stop()
//   }, 500)
// })
