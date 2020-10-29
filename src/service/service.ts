import { exec } from 'child_process'

import { existsSync, unlinkSync, chmodSync, writeFileSync } from 'fs'

import systemdTemplate from './template/systemd'
import initdTemplate from './template/initd'

/**
 * Returns true if system support systemd daemons
 * @return {Boolean}
 */
function hasSystemD () {
  return existsSync('/usr/lib/systemd/system') || existsSync('/bin/systemctl')
}

/**
 * Returns true if system support init.d daemons
 * @return {Boolean}
 */
function hasSystemV () {
  return existsSync('/etc/init.d')
}

/**
 * Deletes a service file from /etc/systemd/system/
 */
async function deleteSystemD (name: string, callback: Function) {
  const filepath = `/etc/systemd/system/${name}.service`
  console.log(`Removing service on: ${filepath}`)
  const exists = existsSync(filepath)
  if (!exists) {
    callback("Service doesn't exists, nothing to uninstall")
    return
  }
  try {
    unlinkSync(filepath)
    const cmd = 'systemctl daemon-reload'
    console.log('Running %s...', cmd)
    exec(cmd, (e) => {
      callback(e, 'SystemD service removed successfully')
    })
  } catch (e) {
    callback(e)
  }
}

/**
 * Installs a service file to /etc/systemd/system/
 *
 * It deals with logs, restarts and by default points
 * to the normal system install
 */
async function setupSystemD (name: string, options: any, callback: Function) {
  options.stdOut = (options.logDir && `${options.logDir}/${name}-out.log`) || null
  options.stdErr = (options.logDir && `${options.logDir}/${name}-err.log`) || null

  const filepath = `/etc/systemd/system/${name}.service`

  const script = systemdTemplate(options)

  if (options.dryRun) {
    console.log(script)
    return
  }

  console.log(`Installing service on: ${filepath}`)

  const exists = existsSync(filepath)
  if (exists) {
    callback('Service already exists, please uninstall first')
    return
  }
  try {
    writeFileSync(filepath, script)
    chmodSync(filepath, '755')
    const cmd = 'systemctl daemon-reload'
    console.log('Running %s...', cmd)
    exec(cmd, (e2) => {
      callback(e2, 'SystemD service registered successfully')
    })
  } catch (e) {
    callback(e)
  }
}

/**
 * Deletes a service file from /etc/init.d/
 */
async function deleteSystemV (name: string, callback: Function) {
  const filepath = `/etc/init.d/${name}`
  console.log(`Removing service on: ${filepath}`)

  const exists = existsSync(filepath)
  if (!exists) {
    callback("Service doesn't exists, nothing to uninstall")
    return
  }

  try {
    unlinkSync(filepath)
    callback(null, 'SystemD service removed successfully')
  } catch (e) {
    callback(e)
  }
}

/**
 * Installs a service file to /etc/init.d/
 *
 * It deals with logs, restarts and by default points
 * to the normal system install
 */
async function setupSystemV (name: string, options: any, callback: Function) {
  options.stdOut = (options.logDir && `${options.logDir}/${name}-out.log`) || '/dev/null'
  options.stdErr = (options.logDir && `${options.logDir}/${name}-err.log`) || '&1'

  const script = initdTemplate(options)

  if (options.dryRun) {
    console.log(script)
    return
  }

  const filepath = `/etc/init.d/${name}`
  console.log(`Installing service on: ${filepath}`)

  const exists = existsSync(filepath)
  if (exists) {
    callback('Service already exists, please uninstall first')
    return
  }

  try {
    writeFileSync(filepath, script)
    chmodSync(filepath, '755')
    callback(null, 'init.d service registered successfully')
  } catch (e) {
    callback(e)
  }
}

/**
 * Adds a service, either via systemd or init.d
 * @param {String}   name the name of the service
 * @param {Object}   options  options to configure deepstream service
 * @param {Function} callback called when complete
 */
export const add = (name: string, options: any, callback: Function) => {
  options.name = name
  options.pidFile = options.pidFile || `/var/run/${name}.pid`

  options.exec = options.exec
  options.logDir = options.logDir || '/var/log/deepstream'
  options.user = options.user || 'root'
  options.group = options.group || 'root'

  if (options && !options.runLevels) {
    options.runLevels = [2, 3, 4, 5].join(' ')
  } else {
    options.runLevels = options.runLevels.join(' ')
  }

  if (!options.programArgs) {
    options.programArgs = []
  }
  options.deepstreamArgs = ['daemon'].concat(options.programArgs).join(' ')

  if (hasSystemD()) {
    setupSystemD(name, options, callback)
  } else if (hasSystemV()) {
    setupSystemV(name, options, callback)
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Delete a service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
export const remove = (name: string, callback: Function) => {
  if (hasSystemD()) {
    deleteSystemD(name, callback)
  } else if (hasSystemV()) {
    deleteSystemV(name, callback)
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Start a service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
export const start = (name: string, callback: Function) => {
  if (hasSystemD() || hasSystemV()) {
    exec(`service ${name} start`, (err, stdOut, stdErr) => {
      callback(err || stdErr, stdOut)
    })
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Stop a service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
export const stop = (name: string, callback: Function) => {
  if (hasSystemD() || hasSystemV()) {
    exec(`service ${name} stop`, (err, stdOut, stdErr) => {
      callback(err || stdErr, stdOut)
    })
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Get the status of the service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
export const status = (name: string, callback: Function) => {
  if (hasSystemD() || hasSystemV()) {
    exec(`service ${name} status`, (err, stdOut, stdErr) => {
      callback(err || stdErr, stdOut)
    })
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}

/**
 * Restart the service, either from systemd or init.d
 * @param {String}   name the name of the service
 * @param {Function} callback called when complete
 */
export const restart = (name: string, callback: Function) => {
  if (hasSystemD() || hasSystemV()) {
    exec(`service ${name} restart`, (err, stdOut, stdErr) => {
      callback(err || stdErr, stdOut)
    })
  } else {
    callback('Only systemd and init.d services are currently supported.')
  }
}
