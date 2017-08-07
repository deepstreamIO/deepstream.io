'use strict'

const rulesMap = require('./rules-map')

// TODO: any of these are fine inside a string or comment context...
const FUNCTION_REGEXP = /([\w]+(?:['"`]\])?)\s*\(/g
const USER_FUNCTION_REGEXP = /[^\w$]function[^\w$]|=>/g
const NEW_REGEXP = /(^|[^\w$])new[^\w$]/
const OLD_DATA_REGEXP = /(^|[^\w~])oldData[^\w~]/
const DATA_REGEXP = /(^|[^\w.~])data($|[^\w~])/

const SUPPORTED_FUNCTIONS = [
  '_',
  'startsWith',
  'endsWith',
  'includes',
  'indexOf',
  'match',
  'toUpperCase',
  'toLowerCase',
  'trim'
]

/**
 * Validates a rule. Makes sure that the rule is either a boolean or a string,
 * that it doesn't contain the new keyword or unsupported function invocations
 * and that it can be compiled into a javascript function
 *
 * @param   {String|Boolean} rule the rule as read from permissions.json
 * @param   {String} section record, event or rpc
 * @param   {String} type read, write, publish, subscribe etc...
 *
 * @public
 * @returns {Boolean} isValid
 */
exports.validate = function (rule, section, type) {
  if (typeof rule === 'boolean') {
    return true
  }

  if (typeof rule !== 'string') {
    return 'rule must be a string'
  }

  if (rule.length === 0) {
    return 'rule can\'t be empty'
  }

  if (rule.match(NEW_REGEXP)) {
    return 'rule can\'t contain the new keyword'
  }

  if (rule.match(USER_FUNCTION_REGEXP)) {
    return 'rule can\'t contain user functions'
  }

  const functions = rule.match(FUNCTION_REGEXP)
  let functionName
  let i

  // TODO _ cross references are only supported for section record
  if (functions) {
    for (i = 0; i < functions.length; i++) {
      functionName = functions[i].replace(/\s*\($/, '')
      if (SUPPORTED_FUNCTIONS.indexOf(functionName) === -1) {
        return `function ${functionName} is not supported`
      }
    }
  }

  try {
    // eslint-disable-next-line
    new Function(rule)
  } catch (e) {
    return e.toString()
  }

  if (!!rule.match(OLD_DATA_REGEXP) && !rulesMap.supportsOldData(type)) {
    return `rule ${type} for ${section} does not support oldData`
  }

  if (!!rule.match(DATA_REGEXP) && !rulesMap.supportsData(type)) {
    return `rule ${type} for ${section} does not support data`
  }

  return true
}

/**
 * Cross References:
 *
 * Cross references are denoted with an underscore function _()
 * They can take path variables: _($someId)
 * variables from data: _(data.someValue)
 * or strings: _('user/egon')
 *
 * @param   {[type]} rule      [description]
 * @param   {[type]} variables [description]
 *
 * @returns {[type]}
 */
exports.parse = function (rule, variables) {
  if (rule === true || rule === false) {
    return {
      fn: rule === true ? function () { return true } : function () { return false },
      hasOldData: false,
      hasData: false
    }
  }
  const ruleObj = {}
  const args = ['_', 'user', 'data', 'oldData', 'now', 'action'].concat(variables)
  args.push(`return ${rule};`)

  ruleObj.fn = Function.apply(this, args)
  ruleObj.hasOldData = !!rule.match(OLD_DATA_REGEXP)
  ruleObj.hasData = !!rule.match(DATA_REGEXP)

  return ruleObj
}
