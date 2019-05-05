import { Cluster } from '../../tools/cluster'
import {Given, When, Before, BeforeAll } from 'cucumber'

Before((scenarioResult, done) => {
  global.cluster.updatePermissions('open', done)
})

Given(/"([^"]*)" permissions are used$/, (permissionType, done) => {
  global.cluster.updatePermissions(permissionType, done)
})

When(/^server (\S)* goes down$/, (server, done) => {
  if (global.cluster.started === false) {
    done()
    return
  }
  global.cluster.once('stopped', done)
  global.cluster.stop()
})

When(/^server (\S)* comes back up$/, (server, done) => {
  if (global.cluster.started) {
    done()
    return
  }
  global.cluster.once('started', () => {
    setTimeout(done, 250)
  })
  global.cluster.start()
})

Given(/^a small amount of time passes$/, (done) => {
  setTimeout(done, 500)
})

BeforeAll((done) => {
  global.cluster = new Cluster(6001, 8001, process.env.ENABLE_LOGGING === 'true')
  global.cluster.once('started', () => {
    setTimeout(done, 200)
  })
  global.cluster.start()
})

// AfterAll((callback) => {
//   setTimeout(() => {
//     global.cluster.once('stopped', () => {
//       callback()
//     })
//     global.cluster.stop()
//   }, 500)
// })
