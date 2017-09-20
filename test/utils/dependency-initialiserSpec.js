/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
/* eslint-disable no-new, no-empty */
'use strict'

const C = require('../../src/constants/constants')
const DependencyInitialiser = require('../../src/utils/dependency-initialiser')
const PluginMock = require('../mocks/plugin-mock')
const LoggerMock = require('../mocks/logger-mock')

describe('dependency-initialiser', () => {
  let dependencyBInitialiser

  const options = {
    pluginA: new PluginMock('A'),
    pluginB: new PluginMock('B'),
    pluginC: new PluginMock('C'),
    brokenPlugin: {},
    logger: new LoggerMock(),
    dependencyInitialisationTimeout: 50
  }

  it('throws an error if dependency doesnt implement emitter or has isReady', () => {
    expect(() => {
      new DependencyInitialiser({}, options, 'brokenPlugin')
    }).toThrow()
    expect(options.logger.lastLogEvent).toBe(C.EVENT.PLUGIN_INITIALIZATION_ERROR)
  })

  it('selects the correct plugin', () => {
    options.logger.lastLogEvent = null
    dependencyBInitialiser = new DependencyInitialiser({}, options, options.pluginB, 'pluginB')
    expect(dependencyBInitialiser.getDependency().name).toBe('B')
    expect(options.logger.lastLogEvent).toBe(null)
  })

  it('notifies when the plugin is ready', (done) => {
    const readySpy = jasmine.createSpy()
    dependencyBInitialiser.on('ready', readySpy)

    options.pluginB.setReady()

    setTimeout(() => {
      expect(options.logger.lastLogEvent).toBe('INFO')
      expect(readySpy.calls.count()).toBe(1)
      done()
    }, 5)
  })

  it('sets deepstream on the plugin if setDeepstream is present', () => {
    const dsMock = { is: 'deepstream' }
    const setDsSpy = options.pluginC.setDeepstream = jasmine.createSpy('setDeepstream')
    options.pluginC.isReady = true
    new DependencyInitialiser(dsMock, options, options.pluginC, 'pluginC')
    expect(setDsSpy).toHaveBeenCalledWith(dsMock)
  })

  it('allows plugins to become ready after deepstream is set', () => {
    const dsMock = { is: 'deepstream' }
    options.pluginC._deepstream = null
    options.pluginC.setDeepstream = (deepstream) => {
      options.pluginC._deepstream = deepstream
      options.pluginC.setReady()
    }
    options.pluginC.isReady = false
    new DependencyInitialiser(dsMock, options, options.pluginC, 'pluginC')
    expect(options.pluginC._deepstream).toBe(dsMock)
  })
})

describe('encounters timeouts and errors during dependency initialisations', () => {
  let dependencyInitialiser
  const onReady = jasmine.createSpy('onReady')
  const originalConsoleLog = console.log
  const options = {
    plugin: new PluginMock('A'),
    logger: new LoggerMock(),
    dependencyInitialisationTimeout: 1
  }

  it('disables console.error', () => {
    Object.defineProperty(console, 'error', {
      value: options.logger.log
    })
  })

  it('creates a depdendency initialiser and doesnt initialise a plugin in time', (done) => {
    dependencyInitialiser = new DependencyInitialiser({}, options, options.plugin, 'plugin')
    dependencyInitialiser.on('ready', onReady)
    expect(options.plugin.isReady).toBe(false)
    process.removeAllListeners('uncaughtException')
    process.once('uncaughtException', () => {
      expect(options.logger.log).toHaveBeenCalledWith(3, 'PLUGIN_ERROR', 'plugin wasn\'t initialised in time')
      done()
    })
    expect(onReady).not.toHaveBeenCalled()
  })

  it('creates another depdendency initialiser with a plugin error', (next) => {
    process.once('uncaughtException', () => {
      expect(onReady).not.toHaveBeenCalled()
      expect(options.logger.log).toHaveBeenCalledWith('Error while initialising dependency')
      expect(options.logger.log).toHaveBeenCalledWith('Error while initialising plugin: something went wrong')
      next()
    })
    dependencyInitialiser = new DependencyInitialiser({}, options, options.plugin, 'plugin')
    dependencyInitialiser.on('ready', onReady)
    options.logger.isReady = false
    try {
      options.plugin.emit('error', 'something went wrong')
      next.fail()
    } catch (_err) {}
  })

  it('enable console.error', () => {
    Object.defineProperty(console, 'error', {
      value: originalConsoleLog
    })
  })
})
