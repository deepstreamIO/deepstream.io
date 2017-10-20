import * as fs from 'fs'
import * as path from 'path'

/**
* Append the global library directory as the prefix to any path
* used here
*/
export const lookupLibRequirePath = function (filePath: string): string {
  return exports.lookupRequirePath(filePath, global.deepstreamLibDir)
}

/**
* Append the global configuration directory as the prefix to any path
* used here
*/
export const lookupConfRequirePath = function (filePath: string): string {
  return exports.lookupRequirePath(filePath, global.deepstreamConfDir)
}

/**
 * Resolve a path which will be passed to *require*.
 *
 * If a prefix is not set the filePath will be returned
 * Otherwise it will either replace return a new path prepended with the prefix.
 * If the prefix is not an absolute path it will also prepend the CWD.
 *
 * file        || relative (starts with .) | absolute | else (npm module path)
 * -----------------------------------------------------------------------------
 * *prefix     || *CWD + prefix + file     | file     | *CWD + prefix + file
 * *no prefix  ||  CWD + file              | file     | file (resolved by nodes require)
 *
 * *CWD = ignore CWD if prefix is absolute
 */
export const lookupRequirePath = function (filePath: string, prefix?: string): string {
  // filePath is absolute
  if (path.parse(filePath).root !== '') {
    return filePath
  }

  // filePath is not relative (and not absolute)
  if (filePath[0] !== '.') {
    if (prefix == null) {
      return filePath
    }
    return resolvePrefixAndFile(filePath, prefix)
  }

  // filePath is relative, starts with .
  if (prefix == null) {
    return path.resolve(process.cwd(), filePath)
  }
  return resolvePrefixAndFile(filePath, prefix)
}

/**
 * Returns true if a file exists for a given path
 */
export const fileExistsSync = function (filePath: string): boolean {
  try {
    fs.lstatSync(filePath)
    return true
  } catch (e) {
    return false
  }
}

/**
* Append the prefix to the current working directory,
* or use it as an absolute path
*/
function resolvePrefixAndFile (nonAbsoluteFilePath: string, prefix: string): string {
  // prefix is not absolute
  if (path.parse(prefix).root === '') {
    return path.resolve(process.cwd(), prefix, nonAbsoluteFilePath)
  }

  // prefix is absolute
  return path.resolve(prefix, nonAbsoluteFilePath)
}
