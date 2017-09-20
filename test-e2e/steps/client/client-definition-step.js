'use strict'

const world = require('../../framework/world')

const cucumber = require('cucumber')
const Before = cucumber.Before
const After = cucumber.After


Before((/* scenario*/) => {
  // client are connecting via "Background" explictly
})

After((scenario, done) => {
  world.endTest(done)
})
