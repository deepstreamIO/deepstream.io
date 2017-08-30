'use strict'

const Cluster = require('../../tools/cluster')

const cucumber = require('cucumber')
const When = cucumber.When
const Then = cucumber.Then
const Given = cucumber.Given
const Before = cucumber.Before
const AfterAll = cucumber.AfterAll
const BeforeAll = cucumber.BeforeAll

Given(/"([^"]*)" permissions are used$/, (permissionType) => {
  global.cluster.updatePermissions(permissionType)
})

When(/^server (\S)* goes down$/, (server, done) => {
  if (global.cluster.started === false) {
    done()
    return
  }
  global.cluster.on('stopped', done)
  global.cluster.stop(done)
})

When(/^server (\S)* comes back up$/, (server, done) => {
  if (global.cluster.started) {
    done()
    return
  }
  global.cluster.on('started', done)
  global.cluster.start()
})

Before((scenario, callback) => {
  global.cluster.updatePermissions('open')
  setTimeout(callback, 100)
})

BeforeAll((callback) => {
  global.cluster = new Cluster(6001, 8001, process.env.ENABLE_LOGGING === 'true')
  global.cluster.on('started', callback)
})

AfterAll((callback) => {
  setTimeout(() => {
    global.cluster.on('stopped', callback)
    global.cluster.stop()
  }, 100)
})
