/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
'use strict'

let messageBuilder = require('../../src/message/message-builder'),
  messageParser = require('../../src/message/message-parser')

/* global it, describe, expect */
describe('variable types are serialized and deserialized correctly', () => {
	// Types
  it('processes strings correctly', () => {
    expect(messageParser.convertTyped('SWolfram')).toBe('Wolfram')
  })

  it('processes objects correctly', () => {
    expect(messageParser.convertTyped('O{"firstname":"Wolfram"}')).toEqual({ firstname: 'Wolfram' })
  })

  it('processes arrays correctly', () => {
    expect(messageParser.convertTyped('O["a","b","c"]')).toEqual(['a', 'b', 'c'])
  })

  it('processes integers correctly', () => {
    expect(messageParser.convertTyped('N42')).toBe(42)
  })

  it('processes floats correctly', () => {
    expect(messageParser.convertTyped('N0.543')).toBe(0.543)
  })

  it('processes null values correctly', () => {
    expect(messageParser.convertTyped('L')).toBe(null)
  })

  it('processes Boolean true correctly', () => {
    expect(messageParser.convertTyped('T')).toBe(true)
  })

  it('processes Boolean false correctly', () => {
    expect(messageParser.convertTyped('F')).toBe(false)
  })

  it('processes undefined correctly', () => {
    expect(messageParser.convertTyped('U')).toBe(undefined)
  })

	// Errors
  it('handles invalid JSON', () => {
	   	expect(messageParser.convertTyped('O{"firstname""Wolfram"}') instanceof Error).toBe(true)
  })

  it('handles unknown types', () => {
	   	expect(messageParser.convertTyped('Qxxx') instanceof Error).toBe(true)
  })

  it('throws errors for unknown types', () => {
    expect(() => {
      messageBuilder.typed(() => {})
    }).toThrow()
  })
})

describe('variable types are serialized and deserialized correctly', () => {
  it('processes strings correctly', () => {
    let input = 'Wolfram',
      typed = messageBuilder.typed(input)

    expect(typed).toBe('SWolfram')
    expect(messageParser.convertTyped(typed)).toBe(input)
  })

  it('processes objects correctly', () => {
    let input = { firstname: 'Wolfram' },
      typed = messageBuilder.typed(input)

    expect(typed).toBe('O{"firstname":"Wolfram"}')
    expect(messageParser.convertTyped(typed)).toEqual(input)
  })

  it('processes arrays correctly', () => {
    let input = ['a', 'b', 'c'],
      typed = messageBuilder.typed(input)

    expect(typed).toBe('O["a","b","c"]')
    expect(messageParser.convertTyped(typed)).toEqual(input)
  })

  it('processes integers correctly', () => {
    let input = 42,
      typed = messageBuilder.typed(input)

    expect(typed).toBe('N42')
    expect(messageParser.convertTyped(typed)).toBe(input)
  })

  it('processes floats correctly', () => {
    let input = 0.543,
      typed = messageBuilder.typed(input)

    expect(typed).toBe('N0.543')
    expect(messageParser.convertTyped(typed)).toBe(input)
  })

  it('processes null values correctly', () => {
    let input = null,
      typed = messageBuilder.typed(input)

    expect(typed).toBe('L')
    expect(messageParser.convertTyped(typed)).toBe(input)
  })

  it('processes Boolean true correctly', () => {
    let input = true,
      typed = messageBuilder.typed(input)

    expect(typed).toBe('T')
    expect(messageParser.convertTyped(typed)).toBe(input)
  })

  it('processes Boolean false correctly', () => {
    let input = false,
      typed = messageBuilder.typed(input)

    expect(typed).toBe('F')
    expect(messageParser.convertTyped(typed)).toBe(input)
  })

  it('processes undefined correctly', () => {
    const typed = messageBuilder.typed()

    expect(typed).toBe('U')
    expect(messageParser.convertTyped(typed)).toBe(undefined)
  })
})
