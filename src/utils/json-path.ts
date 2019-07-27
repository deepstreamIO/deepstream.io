const SPLIT_REG_EXP = /[[\]]/g

/**
* Returns the value of the path or
* undefined if the path can't be resolved
*/
export function getValue (data: any, path: string): any {
  const tokens = tokenize(path)
  let value = data
  for (let i = 0; i < tokens.length; i++) {
    if (value === undefined) {
      return undefined
    }
    if (typeof value !== 'object') {
      throw new Error('invalid data or path')
    }
    value = value[tokens[i]]
  }

  return value
 }

/**
 * This class allows to set or get specific
 * values within a json data structure using
 * string-based paths
 */
export function setValue (root: any, path: string, value: any): void {
  const tokens = tokenize(path)
  let node = root

  let i
  for (i = 0; i < tokens.length - 1; i++) {
    const token = tokens[i]

    if (node[token] !== undefined && typeof node[token] === 'object') {
      node = node[token]
    } else if (typeof tokens[i + 1] === 'number') {
      node = node[token] = []
    } else {
      node = node[token] = {}
    }
  }

  if (value === undefined) {
    delete node[tokens[i]]
  } else {
    node[tokens[i]] = value
  }
}

/**
 * Parses the path. Splits it into
 * keys for objects and indices for arrays.
 */
function tokenize (path: string): Array<string | number> {
  const tokens: Array<string | number> = []

  const parts = path.split('.')

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i].trim()

    if (part.length === 0) {
      continue
    }

    const arrayIndexes: string[] = part.split(SPLIT_REG_EXP)

    if (arrayIndexes.length === 0) {
      // TODO
      continue
    }

    tokens.push(arrayIndexes[0])

    for (let j = 1; j < arrayIndexes.length; j++) {
      if (arrayIndexes[j].length === 0) {
        continue
      }

      tokens.push(Number(arrayIndexes[j]))
    }
  }
  return tokens
}
