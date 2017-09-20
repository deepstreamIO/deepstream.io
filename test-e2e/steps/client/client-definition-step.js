'use strict'

const { When, Then, Given, Before, After } = require('cucumber')

const world = require('../../framework/world')

Before((/* scenario*/) => {
  // client are connecting via "Background" explictly
})

After((scenario, done) => {
  world.endTest(done)
})
