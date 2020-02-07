import 'mocha'
import { expect } from 'chai'

import { Deepstream } from './deepstream.io'
import { PromiseDelay } from './utils/utils';

describe('deepstream.io', () => {

  describe('the main server class', () => {
    it('sets a supported option', () => {
      const server = new Deepstream()
      expect(() => {
        server.set('serverName', 'my lovely horse')
      }).not.to.throw()
    })

    it.skip('sets an unsupported option', async () => {
      const server = new Deepstream()
      await PromiseDelay(50)
      expect(() => {
        server.set('gibberish', 4444)
      }).to.throw()
    })
  })

})
