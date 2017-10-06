'use strict'
/* eslint-disable valid-typeof */
import { EventEmitter } from 'events'
import * as jsYamlLoader from '../config/js-yaml-loader'
import RecordHandler from '../record/record-handler'
import * as configCompiler from './config-compiler'
import * as configValidator from './config-validator'
import RuleApplication from './rule-application'
import RuleCache from './rule-cache'
import * as rulesMap from './rules-map'

const UNDEFINED = 'undefined'

export default class ConfigPermissionHandler extends EventEmitter implements PermissionHandler {
  public isReady: boolean
  public description: string

  private ruleCache: RuleCache
  private permissionOptions: ValveConfig
  private config: DeepstreamConfig
  private services: DeepstreamServices
  private permissions: any
  private logger: Logger
  private recordHandler: RecordHandler
  private optionsValid: boolean

  /**
   * A permission handler that reads a rules config YAML or JSON, validates
   * its contents, compiles it and executes the permissions that it contains
   * against every incoming message.
   *
   * This is the standard permission handler that deepstream exposes, in conjunction
   * with the default permission.yml it allows everything, but at the same time provides
   * a convenient starting point for permission declarations.
   */
  constructor (config: DeepstreamConfig, services: DeepstreamServices, permissions: any) {
    super()
    this.logger = services.logger
    this.config = config
    this.services = services
    this.permissionOptions = config.permission.options
    this.ruleCache = new RuleCache(this.permissionOptions)
    this.isReady = false
    this.description = `valve permissions loaded from ${this.permissionOptions.path}`
    this.optionsValid = true

    const maxRuleIterations = config.permission.options.maxRuleIterations
    if (maxRuleIterations !== undefined && maxRuleIterations < 1) {
      this.optionsValid = false
      process.nextTick(() => this.emit('error', 'Maximum rule iteration has to be at least one '))
    } else if (permissions) {
      this.useConfig(permissions)
    }
  }

  /**
   * Will be invoked with the initialised recordHandler instance by deepstream.io
   */
  public setRecordHandler (recordHandler: RecordHandler): void {
    this.recordHandler = recordHandler
  }

  /**
   * Will be called by the dependency initialiser once server.start() is called.
   * This gives users a chance to change the path using server.set()
   * first
   */
  public init (): void {
    if (!this.permissions && this.optionsValid) {
      this.loadConfig(this.permissionOptions.path)
    }
  }

  /**
   * Load a configuration file. This will either load a configuration file for the first time at
   * startup or reload the configuration at runtime
   *
   * CLI loadConfig <path>
   */
  public loadConfig (filePath: string): void {
    jsYamlLoader.readAndParseFile(filePath, this.onConfigLoaded.bind(this, filePath))
  }

  /**
   * Validates and compiles a loaded config. This can be called as the result
   * of a config being passed to the permissionHandler upon initialisation,
   * as a result of loadConfig or at runtime
   *
   * CLI useConfig <config>
   */
  public useConfig (permissions: any): void {
    const validationResult = configValidator.validate(permissions)

    if (validationResult !== true) {
      this.emit('error', `invalid permission config - ${validationResult}`)
      return
    }

    this.permissions = configCompiler.compile(permissions)
    this.ruleCache.reset()
    this.ready()
  }

  /**
   * Implements the permissionHandler's canPerformAction interface
   * method
   *
   * This is the main entry point for permissionOperations and will
   * be called for every incoming message. This method executes four steps
   *
   * - Check if the incoming message conforms to basic specs
   * - Check if the incoming message requires permissions
   * - Load the applicable permissions
   * - Apply them
   */
  public canPerformAction (username, message, callback, authData, socketWrapper) {
    const ruleSpecification = rulesMap.getRulesForMessage(message)

    if (ruleSpecification === null) {
      callback(null, true)
      return
    }

    const ruleData = this.getCompiledRulesForName(message.name, ruleSpecification)

    if (!ruleData) {
      callback(null, false)
      return
    }

    // tslint:disable-next-line
    new RuleApplication({
      recordHandler: this.recordHandler,
      socketWrapper,
      username,
      authData,
      path: ruleData,
      ruleSpecification,
      message,
      action: ruleSpecification.action,
      regexp: ruleData.regexp,
      rule: ruleData.rule,
      name: message.name,
      callback,
      logger: this.logger,
      permissionOptions: this.permissionOptions,
      config: this.config,
      services: this.services,
    })
  }

  /**
   * Evaluates the rules within a section and returns the matching rule for a path.
   * Takes basic specificity (as deduced from the path length) into account and
   * caches frequently used rules for faster access
   */
  private getCompiledRulesForName (name: string, ruleSpecification: any): any {
    if (this.ruleCache.has(ruleSpecification.section, name, ruleSpecification.type)) {
      return this.ruleCache.get(ruleSpecification.section, name, ruleSpecification.type)
    }

    const section = this.permissions[ruleSpecification.section]
    let i = 0
    let pathLength = 0
    let result: any = null

    for (i; i < section.length; i++) {
      if (
        typeof section[i].rules[ruleSpecification.type] !== UNDEFINED &&
        section[i].path.length >= pathLength &&
        section[i].regexp.test(name)
      ) {
        pathLength = section[i].path.length
        result = {
          path: section[i].path,
          regexp: section[i].regexp,
          rule: section[i].rules[ruleSpecification.type],
        }
      }
    }

    if (result) {
      this.ruleCache.set(ruleSpecification.section, name, ruleSpecification.type, result)
    }

    return result
  }

  /**
   * Callback for loadConfig. Parses the incoming configuration string and forwards
   * it to useConfig if no errors occured
   */
  private onConfigLoaded (filePath: string, loadError: Error, permissions: any): void {
    if (loadError) {
      this.emit('error', `error while loading config: ${loadError.toString()}`)
      return
    }
    this.emit('config-loaded', filePath)
    this.useConfig(permissions)
  }

  /**
   * Sets this permissionHandler to ready. Occurs once the config has been successfully loaded,
   * parsed and compiled
   */
  private ready (): void {
    if (this.isReady === false) {
      this.isReady = true
      this.emit('ready')
    }
  }

}
