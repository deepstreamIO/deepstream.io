import {Given, When, Before, BeforeAll } from 'cucumber'
import { PromiseDelay } from '../../../src/utils/utils'
import { E2EHarness } from '../../tools/e2e-harness'

Before(async (scenarioResult) => {
  await global.e2eHarness.updatePermissions('open')
})

Given(/"([^"]*)" permissions are used$/, async (permissionType) => {
  await global.e2eHarness.updatePermissions(permissionType)
})

When('storage remote updates {string} to {string} with version {int}', async (recordName, data, version) => {
  await global.e2eHarness.updateStorageDirectly(recordName, version, data)
})

When('storage remote deletes {string}', async (recordName) => {
  await global.e2eHarness.deleteFromStorageDirectly(recordName)
})

When(/^server (\S)* goes down$/, async (server) => {
  if (global.e2eHarness.started === false) {
    return
  }
  await global.e2eHarness.stopServer(server)
})

When(/^all servers go down$/, async () => {
  if (global.e2eHarness.started === false) {
    return
  }
  await global.e2eHarness.stop()
  await PromiseDelay(200)
})

When(/^server (\S)* comes back up$/, async (server) => {
  if (global.e2eHarness.started) {
    return
  }
  await global.e2eHarness.startServer(server)
})

When(/^all servers come back up$/, async () => {
  if (global.e2eHarness.started === true) {
    return
  }
  await global.e2eHarness.start()
  await PromiseDelay(200)
})

Given(/^a small amount of time passes$/, (done) => {
  setTimeout(done, 500)
})

BeforeAll(async () => {
  global.e2eHarness = new E2EHarness([6001, 7001, 8001], process.env.ENABLE_LOGGING === 'true')
  await global.e2eHarness.start()
  await PromiseDelay(200)
})

// AfterAll((callback) => {
//   setTimeout(() => {
//     global.e2eHarness.once('stopped', () => {
//       callback()
//     })
//     global.e2eHarness.stop()
//   }, 500)
// })
