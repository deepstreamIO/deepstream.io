/* global jasmine, spyOn, describe, it, expect, beforeEach, afterEach */
/* eslint-disable no-new, no-empty */
'use strict'

const C = require('../../src/constants')
const DependencyInitialiser = require('../../src/utils/dependency-initialiser').default
const PluginMock = require('../test-mocks/plugin-mock')
const LoggerMock = require('../test-mocks/logger-mock')

const services = {
  logger: new LoggerMock()
}

describe('dependency-initialiser', () => {
  let dependencyBInitialiser

  const config = {
    pluginA: new PluginMock({}, 'A'),
    pluginB: new PluginMock({}, 'B'),
    pluginC: new PluginMock({}, 'C'),
    brokenPlugin: {},
    dependencyInitialisationTimeout: 50
  }

  it('throws an error if dependency doesnt implement emitter or has isReady', () => {
    expect(() => {
      new DependencyInitialiser({}, config, services, 'brokenPlugin')
    }).toThrow()
    expect(services.logger.lastLogEvent).toBe(C.EVENT.PLUGIN_INITIALIZATION_ERROR)
  })

  it('selects the correct plugin', () => {
    services.logger.lastLogEvent = null
    dependencyBInitialiser = new DependencyInitialiser({}, config, services, config.pluginB, 'pluginB')
    expect(dependencyBInitialiser.getDependency().description).toBe('B')
    expect(services.logger.lastLogEvent).toBe(null)
  })

  it('notifies when the plugin is ready', (done) => {
    const readySpy = jasmine.createSpy()
    dependencyBInitialiser.on('ready', readySpy)

    config.pluginB.setReady()

    setTimeout(() => {
      expect(services.logger.lastLogEvent).toBe('INFO')
      expect(readySpy.calls.count()).toBe(1)
      done()
    }, 5)
  })

  it('sets deepstream on the plugin if setDeepstream is present', () => {
    const dsMock = { is: 'deepstream' }
    const setDsSpy = config.pluginC.setDeepstream = jasmine.createSpy('setDeepstream')
    config.pluginC.isReady = true
    new DependencyInitialiser(dsMock, config, services, config.pluginC, 'pluginC')
    expect(setDsSpy).toHaveBeenCalledWith(dsMock)
  })

  it('allows plugins to become ready after deepstream is set', () => {
    const dsMock = { is: 'deepstream' }
    config.pluginC._deepstream = null
    config.pluginC.setDeepstream = (deepstream) => {
      config.pluginC._deepstream = deepstream
      config.pluginC.setReady()
    }
    config.pluginC.isReady = false
    new DependencyInitialiser(dsMock, config, services, config.pluginC, 'pluginC')
    expect(config.pluginC._deepstream).toBe(dsMock)
  })
})

describe('encounters timeouts and errors during dependency initialisations', () => {
  let dependencyInitialiser
  const onReady = jasmine.createSpy('onReady')
  const originalConsoleLog = console.log
  const config = {
    plugin: new PluginMock('A'),
    dependencyInitialisationTimeout: 1
  }

  it('disables console.error', () => {
    Object.defineProperty(console, 'error', {
      value: services.logger.log
    })
  })

  it('creates a depdendency initialiser and doesnt initialise a plugin in time', (done) => {
    dependencyInitialiser = new DependencyInitialiser({}, config, services, config.plugin, 'plugin')
    dependencyInitialiser.on('ready', onReady)
    expect(config.plugin.isReady).toBe(false)
    process.removeAllListeners('uncaughtException')
    process.once('uncaughtException', () => {
      expect(services.logger.log).toHaveBeenCalledWith(3, 'PLUGIN_ERROR', 'plugin wasn\'t initialised in time')
      done()
    })
    expect(onReady).not.toHaveBeenCalled()
  })

  it('creates another depdendency initialiser with a plugin error', (next) => {
    process.once('uncaughtException', () => {
      expect(onReady).not.toHaveBeenCalled()
      expect(services.logger.log).toHaveBeenCalledWith('Error while initialising dependency')
      expect(services.logger.log).toHaveBeenCalledWith('Error while initialising plugin: something went wrong')
      next()
    })
    dependencyInitialiser = new DependencyInitialiser({}, config, services, config.plugin, 'plugin')
    dependencyInitialiser.on('ready', onReady)
    services.logger.isReady = false
    try {
      config.plugin.emit('error', 'something went wrong')
      next.fail()
    } catch (_err) {}
  })

  it('enable console.error', () => {
    Object.defineProperty(console, 'error', {
      value: originalConsoleLog
    })
  })
})
