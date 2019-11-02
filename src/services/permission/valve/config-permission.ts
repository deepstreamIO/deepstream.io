import * as configCompiler from './config-compiler'
import * as configValidator from './config-validator'
import RuleApplication from './rule-application'
import RuleCache from './rule-cache'
import * as rulesMap from './rules-map'
import { Message, RECORD_ACTION, EVENT_ACTION, RPC_ACTION, PRESENCE_ACTION } from '../../../constants'
import RecordHandler from '../../../handlers/record/record-handler'
import { DeepstreamPlugin, DeepstreamPermission, ValveConfig, DeepstreamServices, DeepstreamConfig, PermissionCallback, SocketWrapper, EVENT, ValveSchema } from '@deepstream/types'

const UNDEFINED = 'undefined'

export type RuleType = string
export type ValveSection = string

export class ConfigPermission extends DeepstreamPlugin implements DeepstreamPermission {
  public description = 'Valve Permissions'

  private ruleCache: RuleCache
  private permissions: any
  private recordHandler: RecordHandler | null = null
  private logger = this.services.logger.getNameSpace('PERMISSION')

  /**
   * A permission handler that reads a rules config YAML or JSON, validates
   * its contents, compiles it and executes the permissions that it contains
   * against every incoming message.
   *
   * This is the standard permission handler that deepstream exposes, in conjunction
   * with the default permission.yml it allows everything, but at the same time provides
   * a convenient starting point for permission declarations.
   */
  constructor (private permissionOptions: ValveConfig, private services: Readonly<DeepstreamServices>, private config: Readonly<DeepstreamConfig>) {
    super()
    this.ruleCache = new RuleCache(this.permissionOptions)

    const maxRuleIterations = permissionOptions.maxRuleIterations
    if (maxRuleIterations !== undefined && maxRuleIterations < 1) {
      this.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, 'Maximum rule iteration has to be at least one')
    }
    this.useConfig(permissionOptions.permissions)
  }

  public async whenReady (): Promise<void> {
  }

  public async close () {
    this.ruleCache.close()
  }

  /**
   * Will be invoked with the initialized recordHandler instance by deepstream.io
   */
  public setRecordHandler (recordHandler: RecordHandler): void {
    this.recordHandler = recordHandler
  }

  /**
   * Validates and compiles a loaded config. This can be called as the result
   * of a config being passed to the permission service upon initialization,
   * as a result of loadConfig or at runtime
   *
   * CLI useConfig <config>
   */
  public useConfig (permissions: ValveSchema): void {
    const validationResult = configValidator.validate(permissions)

    if (validationResult !== true) {
      this.logger.fatal(EVENT.PLUGIN_INITIALIZATION_ERROR, `invalid permission config - ${validationResult}`)
      return
    }

    this.permissions = configCompiler.compile(permissions)
    this.ruleCache.reset()
  }

  /**
   * Implements the permission service's canPerformAction interface
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
  public canPerformAction (socketWrapper: SocketWrapper, message: Message, callback: PermissionCallback, passItOn: any) {
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
      userId: socketWrapper.userId,
      serverData: socketWrapper.serverData,
      path: ruleData,
      ruleSpecification,
      message,
      action: ruleSpecification.action as (RECORD_ACTION | EVENT_ACTION | RPC_ACTION | PRESENCE_ACTION),
      regexp: ruleData.regexp,
      rule: ruleData.rule,
      name: message.name!,
      callback,
      passItOn,
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
}
