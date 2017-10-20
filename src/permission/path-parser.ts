const WILDCARD_REGEXP = /\*/g
const WILDCARD_STRING = '.*'
const VARIABLE_REGEXP = /(\$[a-zA-Z0-9]+)/g
const VARIABLE_STRING = '([^/]+)'
const INVALID_VARIABLE_REGEXP = /(\$[^a-zA-Z0-9])/

/**
 * Checks a path for type and basic syntax errors
 *
 * @param   {String} path The path as specified in permission.json
 *
 * @public
 * @returns {String|Boolean} true if path is valid, string error message if not
 */
export const validate = (path: string): string | boolean => {
  if (typeof path !== 'string') {
    return 'path must be a string'
  }

  if (path.length === 0) {
    return 'path can\'t be empty'
  }

  if (path[0] === '/') {
    return 'path can\'t start with /'
  }

  const invalidVariableNames = path.match(INVALID_VARIABLE_REGEXP)

  if (invalidVariableNames !== null) {
    return `invalid variable name ${invalidVariableNames[0]}`
  }

  return true
}

/**
 * Parses a path and returns a regexp matcher with capture groups for
 * variable names and a list of variable names in the same order.
 * The path is assumed to be valid when its passed to this method
t */
export const parse = (path: string): any => {
  const variables: Array<string> = []
  let regExp = path.replace(WILDCARD_REGEXP, WILDCARD_STRING)

  regExp = regExp.replace(VARIABLE_REGEXP, variableName => {
    variables.push(variableName)
    return VARIABLE_STRING
  })

  return {
    variables,
    path,
    regexp: new RegExp(`^${regExp}$`),
  }
}
