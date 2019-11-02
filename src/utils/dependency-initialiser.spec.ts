import 'mocha'
import { expect } from 'chai'
import { spy } from 'sinon'
import { DependencyInitialiser } from './dependency-initialiser'
import PluginMock from '../test/mock/plugin-mock'
import LoggerMock from '../test/mock/logger-mock'
import { LOG_LEVEL, EVENT } from '@deepstream/types';
import { PromiseDelay } from './utils';

const services = {
  logger: new LoggerMock()
}

describe('dependency-initialiser', () => {
  let dependencyBInitialiser: DependencyInitialiser
  let config: any

  beforeEach(() => {
    config = {
      pluginA: new PluginMock({ name:'A' }),
      pluginB: new PluginMock({ name: 'B'}),
      pluginC: new PluginMock({ name: 'C'}),
      brokenPlugin: {},
      dependencyInitializationTimeout: 50
    }
    services.logger.lastLogEvent = null
  })

  it ('sets description', () => {
    dependencyBInitialiser = new DependencyInitialiser(config as any, services as any, config.pluginB, 'pluginB')
    expect(dependencyBInitialiser.getDependency().description).to.equal('B')
    expect(services.logger.lastLogEvent).to.equal(null)
  })

  it('throws an error if dependency doesnt implement emitter or has isReady', () => {
    expect(() => {
      // tslint:disable-next-line:no-unused-expression
      new DependencyInitialiser(config as any, services as any, {} as any, 'brokenPlugin')
    }).to.throw()
    expect(services.logger.lastLogEvent).to.equal(EVENT.PLUGIN_INITIALIZATION_ERROR)
  })

  it('notifies when the plugin is ready with when already ready', async () => {
    config.pluginB.isReady = true
    dependencyBInitialiser = new DependencyInitialiser(config as any, services as any, config.pluginB, 'pluginB')
    await dependencyBInitialiser.whenReady()
    expect(services.logger.lastLogEvent).to.equal(EVENT.INFO)
  })

  it('notifies when the plugin is ready with when not ready', (done) => {
    dependencyBInitialiser = new DependencyInitialiser(config as any, services as any, config.pluginB, 'pluginB')
    dependencyBInitialiser.whenReady().then(() => {
      expect(services.logger.lastLogEvent).to.equal(EVENT.INFO)
      done()
    })
    config.pluginB.setReady()
  })
})

describe('encounters timeouts and errors during dependency initialisations', () => {
  let dependencyInitialiser
  const onReady = spy()
  const originalConsoleLog = console.log
  const config = {
    plugin: new PluginMock('A'),
    dependencyInitializationTimeout: 1,
  }

  it('disables console.error', () => {
    Object.defineProperty(console, 'error', {
      value: services.logger.log
    })
  })

  it("creates a dependency initialiser and doesn't initialize a plugin in time", async () => {
    services.logger.logSpy.resetHistory()
    dependencyInitialiser = new DependencyInitialiser(config as any, services as any, config.plugin, 'plugin')

    await PromiseDelay(20)

    dependencyInitialiser.whenReady().then(onReady)
    expect(config.plugin.isReady).to.equal(false)
    expect(onReady).to.have.callCount(0)

    // expect(services.logger.logSpy).to.have.been.calledOnce // another test isn't async and bleeds into this one
    expect(services.logger.logSpy).to.have.been.calledWith(LOG_LEVEL.FATAL, EVENT.PLUGIN_INITIALIZATION_TIMEOUT, 'plugin wasn\'t initialised in time')
  })

  it.skip('creates another depdendency initialiser with a plugin error', async () => {
    process.once('uncaughtException', () => {
      expect(onReady).to.have.callCount(0)
      expect(services.logger.logSpy).to.have.been.calledWith('Error while initialising dependency')
      expect(services.logger.logSpy).to.have.been.calledWith('Error while initialising plugin: something went wrong')
      next()
    })
    dependencyInitialiser = new DependencyInitialiser({}, config as any, services as any, config.plugin, 'plugin')
    dependencyInitialiser.on('ready', onReady)
    try {
      config.plugin.emit('error', 'something went wrong')
      next('Fail')
    } catch (err) {}
  })

  it('enable console.error', () => {
    Object.defineProperty(console, 'error', {
      value: originalConsoleLog
    })
  })
})
