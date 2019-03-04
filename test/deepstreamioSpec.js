/* eslint-disable camelcase */
/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach, xdescribe  */
'use strict'

const Deepstream = require('../src/deepstream.io')

describe('deepstream.io', () => {

  describe('the main server class', () => {
    it('exposes the message parser\'s convertTyped method', () => {
      const server = new Deepstream()
      expect(server.convertTyped('N42')).toBe(42)
    })

    it('exposes constants as a static', () => {
      expect(Deepstream.constants).toBeDefined()
    })

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
