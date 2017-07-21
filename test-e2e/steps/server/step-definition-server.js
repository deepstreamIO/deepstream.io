'use strict'

const Cluster = require('../../tools/cluster')

module.exports = function () {

  this.Given(/"([^"]*)" permissions are used$/, (permissionType) => {
    global.cluster.updatePermissions(permissionType)
  })

  this.When(/^server (\S)* goes down$/, (server, done) => {
    if (global.cluster.started === false) {
      done()
      return
    }
    global.cluster.on('stopped', done)
    global.cluster.stop(done)
  })

  this.When(/^server (\S)* comes back up$/, (server, done) => {
    if (global.cluster.started) {
      done()
      return
    }
    global.cluster.on('started', done)
    global.cluster.start()
  })

  this.registerHandler('BeforeFeature', (features, callback) => {
    global.cluster = new Cluster(6001, 8001, process.env.ENABLE_LOGGING === 'true')
    global.cluster.on('started', callback)
  })

  this.registerHandler('AfterFeature', (features, callback) => {
    setTimeout(() => {
      global.cluster.on('stopped', callback)
      global.cluster.stop()
    }, 100)
  })

}
