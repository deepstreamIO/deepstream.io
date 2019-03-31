import {Before, After} from 'cucumber'
import { world } from '../../framework/world'

Before((/* scenario*/) => {
  // client are connecting via "Background" explictly
})

After((scenario, done) => {
  world.endTest(done)
})
