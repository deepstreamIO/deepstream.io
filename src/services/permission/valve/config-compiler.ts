import * as pathParser from './path-parser'
import * as ruleParser from './rule-parser'
import { ValveSchema } from '@deepstream/types'

/**
 * Compiles a pre-validated config into a format that allows for quicker access
 * and execution
 */
export const compile = function (config: ValveSchema) {
  const compiledConfig: any = {}
  let compiledRuleset
  let section
  let path

  for (section in config) {
    compiledConfig[section] = []

    for (path in config[section]) {
      compiledRuleset = compileRuleset(path, config[section][path])
      compiledConfig[section].push(compiledRuleset)
    }
  }

  return compiledConfig
}

/**
 * Compiles an individual ruleset
 */
function compileRuleset (path: string, rules: any) {
  const ruleset = pathParser.parse(path)

  ruleset.rules = {}

  for (const ruleType in rules) {
    ruleset.rules[ruleType] = ruleParser.parse(
      rules[ruleType], ruleset.variables,
    )
  }

  return ruleset
}
