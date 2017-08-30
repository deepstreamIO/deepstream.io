'use strict'

const Cluster = require('../../tools/cluster')

const { When, Then, Given, Before, BeforeAll, AfterAll } = require('cucumber')

Before((scenarioResult, done) => {
  global.cluster.updatePermissions('open', done)
})

Given(/^a small amount of time passes$/, (done) => {
  setTimeout(done, 500)
})

Given(/"([^"]*)" permissions are used$/, (permissionType, done) => {
  global.cluster.updatePermissions(permissionType, done)
})

When(/^server (\S)* goes down$/, (server, done) => {
  global.cluster.stopServer(server - 1, done)
})

When(/^server (\S)* comes back up$/, (server, done) => {
  global.cluster.startServer(server - 1, done)
})

BeforeAll((callback) => {
  global.cluster = new Cluster([6001, 6002, 6003], !!process.env.LOG)
  global.cluster.on('ready', callback)
})

AfterAll((callback) => {
  setTimeout(() => {
    global.cluster.on('stopped', () => {
      callback()
    })
    global.cluster.stop()
  }, 100)
})
