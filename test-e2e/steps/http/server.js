/* eslint-disable new-cap */
/*
 *'use strict'
 *
 *const Cluster = require('../../tools/cluster')
 *
 *module.exports = function () {
 *
 *  this.Given(/"([^"]*)" permissions are used$/, (permissionType, done) => {
 *    global.cluster.updatePermissions(permissionType, done)
 *  })
 *
 *  this.When(/^server (\S)* goes down$/, (server, done) => {
 *    global.cluster.stopServer(server - 1, done)
 *  })
 *
 *  this.When(/^server (\S)* comes back up$/, (server, done) => {
 *    global.cluster.startServer(server - 1, done)
 *  })
 *
 *  this.registerHandler('BeforeFeature', (features, callback) => {
 *    global.cluster = new Cluster([6001], [8001], false)
 *    global.cluster.on('ready', callback)
 *  })
 *
 *  this.registerHandler('AfterFeature', (features, callback) => {
 *    setTimeout(() => {
 *      global.cluster.on('stopped', () => {
 *        callback()
 *      })
 *      global.cluster.stop()
 *    }, 100)
 *  })
 *}
 */
