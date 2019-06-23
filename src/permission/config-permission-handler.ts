import * as jsYamlLoader from '../config/js-yaml-loader'
import { EVENT_ACTIONS, PRESENCE_ACTIONS, RECORD_ACTIONS, RPC_ACTIONS, Message, JSONObject } from '../constants'
import RecordHandler from '../record/record-handler'
import * as configCompiler from './config-compiler'
import * as configValidator from './config-validator'
import RuleApplication from './rule-application'
import RuleCache from './rule-cache'
import * as rulesMap from './rules-map'
import { PermissionHandler, ValveConfig, DeepstreamConfig, DeepstreamServices, PermissionCallback, SocketWrapper, ValveSection, DeepstreamPlugin } from '../types'

const UNDEFINED = 'undefined'

export default class ConfigPermissionHandler extends DeepstreamPlugin implements PermissionHandler {
  public isReady: boolean = false
  public description: string = `valve permissions loaded from ${this.permissionOptions.path}`

  private ruleCache: RuleCache
  private permissions: any
  private recordHandler: RecordHandler | null = null
  private optionsValid: boolean = true

  /**
   * A permission handler that reads a rules config YAML or JSON, validates
   * its contents, compiles it and executes the permissions that it contains
   * against every incoming message.
   *
   * This is the standard permission handler that deepstream exposes, in conjunction
   * with the default permission.yml it allows everything, but at the same time provides
   * a convenient starting point for permission declarations.
   */
  constructor (private permissionOptions: ValveConfig, private services: DeepstreamServices, private config: DeepstreamConfig, permissions?: ValveSection) {
    super()
    this.ruleCache = new RuleCache(this.permissionOptions)

    const maxRuleIterations = permissionOptions.maxRuleIterations
    if (maxRuleIterations !== undefined && maxRuleIterations < 1) {
      this.optionsValid = false
      process.nextTick(() => this.emit('error', 'Maximum rule iteration has to be at least one '))
    } else if (permissions) {
      this.useConfig(permissions)
    }
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
   * Will be invoked with the initialised recordHandler instance by deepstream.io
   */
  public setRecordHandler (recordHandler: RecordHandler): void {
    this.recordHandler = recordHandler
  }

  /**
   * Load a configuration file. This will either load a configuration file for the first time at
   * startup or reload the configuration at runtime
   *
   * CLI loadConfig <path>
   */
  public loadConfig (filePath: string): void {
    jsYamlLoader.readAndParseFile(filePath, (loadError: Error | null, permissions: any) => {
      if (loadError) {
        this.emit('error', `error while loading config: ${loadError.toString()}`)
        return
      }
      this.emit('config-loaded', filePath)
      this.useConfig(permissions)
    })
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
  public canPerformAction (username: string, message: Message, callback: PermissionCallback, authData: JSONObject, socketWrapper: SocketWrapper, passItOn: any) {
    const ruleSpecification = rulesMap.getRulesForMessage(message)

    if (ruleSpecification === null) {
      callback(socketWrapper, message, passItOn, null, true)
      return
    }

    const ruleData = this.getCompiledRulesForName(message.name!, ruleSpecification)
    if (!ruleData) {
      callback(socketWrapper, message, passItOn, null, false)
      return
    }

    // tslint:disable-next-line
    new RuleApplication({
      recordHandler: this.recordHandler!,
      socketWrapper,
      username,
      authData,
      path: ruleData,
      ruleSpecification,
      message,
      action: ruleSpecification.action as (RECORD_ACTIONS | EVENT_ACTIONS | RPC_ACTIONS | PRESENCE_ACTIONS),
      regexp: ruleData.regexp,
      rule: ruleData.rule,
      name: message.name!,
      callback,
      passItOn,
      logger: this.services.logger,
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
    const compiledRules = this.ruleCache.get(ruleSpecification.section, name, ruleSpecification.type)
    if (compiledRules) {
      return compiledRules
    }

    const sections = this.permissions[ruleSpecification.section]
    let pathLength = 0
    let result: any = null

    for (let i = 0; i < sections.length; i++) {
      const { rules, path, regexp } = sections[i]
      if (typeof rules[ruleSpecification.type] !== UNDEFINED && path.length >= pathLength && regexp.test(name)) {
        pathLength = path.length
        result = {
          path,
          regexp,
          rule: rules[ruleSpecification.type],
        }
      }
    }

    if (result) {
      this.ruleCache.set(ruleSpecification.section, name, ruleSpecification.type, result)
    }

    return result
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
