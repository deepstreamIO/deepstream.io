'use strict'

const Cluster = require('../../tools/cluster')

const cucumber = require('cucumber')
const Given = cucumber.Given
const When = cucumber.When
const Then = cucumber.Then
const Before = cucumber.Before
const BeforeAll = cucumber.BeforeAll
const AfterAll = cucumber.AfterAll

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
  global.cluster.once('started', done)
  global.cluster.start()
})

Given(/^a small amount of time passes$/, (done) => {
  setTimeout(done, 500)
})

BeforeAll((callback) => {
  global.cluster = new Cluster(6001, 8001, process.env.ENABLE_LOGGING === 'true')
  global.cluster.once('started', () => {
    setTimeout(callback, 200)
  })
  global.cluster.start()
})

AfterAll((callback) => {
  setTimeout(() => {
    global.cluster.once('stopped', () => {
      callback()
    })
    global.cluster.stop()
  }, 500)
})
