import {Before, After} from 'cucumber'
const { world } = require(`../../framework${process.env.V3 ? '-v3' : ''}/world`)

Before((/* scenario*/) => {
  // client are connecting via "Background" explictly
})

After((scenario, done) => {
  world.endTest(done!)
})
