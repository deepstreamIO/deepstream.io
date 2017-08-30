'use strict'

const cucumber = require('cucumber')
const Before = cucumber.Before
const After = cucumber.After

const world = require('../../framework/world')

Before((/* scenario*/) => {
  // client are connecting via "Background" explictly
})

After((scenario, done) => {
  world.endTest(done)
})
