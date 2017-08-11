'use strict'

const Cluster = require('../../tools/cluster')

module.exports = function () {

  this.Given(/"([^"]*)" permissions are used$/, (permissionType) => {
    global.cluster.updatePermissions(permissionType)
  })

  this.When(/^server (\S)* goes down$/, (server, done) => {
    global.cluster.stopServer(server - 1, done)
  })

  this.When(/^server (\S)* comes back up$/, (server, done) => {
    global.cluster.startServer(server - 1, done)
  })

  this.registerHandler('BeforeFeature', (features, callback) => {
    global.cluster = new Cluster([6001, 6002, 6003], !!process.env.LOG)
    global.cluster.on('ready', callback)
  })

  this.registerHandler('AfterFeature', (features, callback) => {
    setTimeout(() => {
      global.cluster.on('stopped', () => {
        callback()
      })
      global.cluster.stop()
    }, 100)
  })

}
