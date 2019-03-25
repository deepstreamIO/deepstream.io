const { Deepstream } = require('../src/deepstream.io')

describe('deepstream.io', () => {

  describe('the main server class', () => {
    it('sets a supported option', () => {
      const server = new Deepstream()
      expect(() => {
        server.set('serverName', 'my lovely horse')
      }).not.toThrow()
    })

    it('sets an unsupported option', () => {
      const server = new Deepstream()
      expect(() => {
        server.set('gibberish', 4444)
      }).toThrow()
    })
  })

})
