import chalk from 'chalk'
import * as needle from 'needle'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as AdmZip from 'adm-zip'
import { execSync } from 'child_process'
import * as mkdirp from 'mkdirp'
import { JSONObject } from '../../binary-protocol/src/message-constants'

const CONFIG_EXAMPLE_FILE = 'example-config.yml'
const SYSTEM: { [index: string]: string } = {
  linux: 'linux',
  darwin: 'mac',
  win32: 'windows'
}
const platform = SYSTEM[os.platform()]

const getWebUrl = (repo: string): string => `https://github.com/deepstreamIO/${repo}/releases`

/**
 * Download a release from GitHub releases API with with the deepstream connector
 * name convention: deepstreamIO/deepstream.io-TYPE-NAME
 *
 * @param  {array}    releases JSON array of the GitHub REST API for list releases
 * @param  {string}   type Connector type: {cache|storage}
 * @param  {string}   name Name of the connector
 * @param  {string}   version Version of the connector (optional)
 * @param  {string}   outputDir Path to directory where to install and extract the connector
 * @callback callback
 * @param {error} error
 * @param {Object} {{archive: String, name: String, version: String}}
 * @return {void}
 */
const downloadRelease = (releases: any, type: string, name: string, version: string, outputDir: string, callback: any): void => {
  outputDir = outputDir == null ? 'lib' : outputDir
  const repo = `deepstream.io-${type}-${name}`
  const filteredReleases = releases.filter((item: any) => {
    if (version == null) {
      return true
    }
    return item.tag_name === version || item.tag_name === `v${version}`
  })
  if (filteredReleases.length === 0) {
    return callback(new Error(`${repo} ${version} not found, see ${getWebUrl(repo)}`))
  }
  const release = filteredReleases[0]
  version = version == null ? release.tag_name : version
  const releaseForMachine = release.assets.filter((item: any) => item.name.indexOf(platform) !== -1)
  if (releaseForMachine.length === 0) {
    return callback(new Error(`Release for your platform not found, see ${getWebUrl(repo)}`))
  }

  const downloadUrl = releaseForMachine[0].browser_download_url
  const extension = path.extname(downloadUrl)
  const basename = path.basename(downloadUrl, extension).replace('deepstream.io-', '')
  const urlBase = 'https://github.com'
  const urlPath = downloadUrl.substr(urlBase.length)
  const basenameWithVersion = `${basename}-${version}${extension}`
  const outputFile = path.join(outputDir, basenameWithVersion)
  mkdirp.sync(outputDir)

  if (process.env.VERBOSE) {
    console.log(`Downloading version ${version}`)
  }
  const outStream = fs.createWriteStream(outputFile)
  downloadArchive(urlPath, outStream, (err) => {
    if (err) {
      return callback(err)
    }
    callback(null, {
      archive: outputFile,
      name: repo,
      version
    })
  })
}

/**
 * Downloads an archive usually zip or tar.gz from a URL which comes from the GitHub
 * release API.
 */
const downloadArchive = (urlPath: string, outStream: any, callback: (error: Error | null) => void): void => {
  needle.get(`https://github.com${urlPath}`, {
    follow_max: 5,
    headers: { 'User-Agent': 'nodejs-client' }
  }, (error, response) => {
    if (error) {
      return callback(error)
    }
    outStream.write(response.body)
    outStream.end()
    if (process.env.VERBOSE) {
      process.stdout.write('Download complete' + '\n')
    }
    return callback(null)
  })
}

/**
 * Fetch a JSON array from GitHub Release API which contains all meta data
 * for a specific reposotiry.
 */
const fetchReleases = function (type: string, name: string, callback: (error: Error | null, result?: JSONObject) => void): void {
  const repo = `deepstream.io-${type}-${name}`
  const urlPath = `/repos/deepstreamIO/${repo}/releases`
  if (process.env.VERBOSE) {
    console.log(`searching for ${repo}`)
  }
  needle.get(`https://api.github.com${urlPath}`, {
    headers: { 'User-Agent': 'nodejs-client' },
  }, (error, response) => {
    if (error) {
      return callback(error)
    }
    if (response.statusCode === 404) {
      return callback(new Error('Not found, see available connectors on //deepstream.io/install/'))
    }
    if (response.statusCode === 403) {
      // API rate limit
      return callback(new Error(response.body.message))
    }
    callback(null, response.body)
  })
}

/**
 * Fetch a JSON array from GitHub Release API which contains all meta data
 * for a specific reposotiry.
 *
 * @return {String}   outPath The directory where the connector was extracted to
 */
const extract = (data: { archive: string, name: string, version: string }): string => {
  const archivePath = data.archive
  const outputParent = path.dirname(archivePath)
  const outPath = path.join(outputParent, data.name)
  try {
    if (platform === 'linux') {
      execSync(`mkdir -p ${outPath} && tar -xzf ${archivePath} -C ${outPath}`)
    } else {
      extractZip(archivePath, outPath)
    }
  } catch (err) {
    if (process.env.VERBOSE) {
      console.error(err)
    }
    throw new Error('Could not extract archive')
  }
  if (!process.env.QUIET) {
    console.log(chalk.green(`${data.name} ${data.version} was installed to ${outputParent}`))
  }
  return outPath
}

/**
 * Extracts an archive to a specific directory
 */
const extractZip = (archivePath: string, outputDirectory: string) => {
  const zip = new AdmZip(archivePath)
  zip.extractAllTo(outputDirectory, true)
}

/**
 * Prints out the config snippet of a extract connector to the stdout.
 * Output is indented and grey colored.
 */
const showConfig = (directory: string) => {
  try {
    const content = fs.readFileSync(path.join(directory, CONFIG_EXAMPLE_FILE), 'utf8')
    if (process.env.VERBOSE) {
      console.log('You need to configure the connector in your deepstream configuration file')
    }
    if (!process.env.QUIET) {
      console.log(`Example configuration:\n${chalk.grey(content)}`)
    }
  } catch (err) {
    if (!process.env.QUIET) {
      console.log('Example configuration not found')
    }
  }
}

interface InstallerOptions {
  type: string
  name: string
  version: string
  dir: string
}

/**
 * Download, extract and show configuration for deepstream connector
 */
export const installer = (opts: InstallerOptions, callback: Function) => {
  fetchReleases(opts.type, opts.name, (fetchError: any, releases: any) => {
    if (fetchError) {
      return callback(fetchError)
    }
    downloadRelease(releases, opts.type, opts.name, opts.version, opts.dir, (error: any, result: any) => {
      if (error) {
        return callback(error)
      }
      try {
        const extractedDirectory = extract(result)
        showConfig(extractedDirectory)
        callback()
      } catch (error) {
        callback(error)
      }
    })
  })
}
