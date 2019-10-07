// Handle input parameters
import { spawn, ChildProcess } from 'child_process'

const maxMilliseconds = 5000

function _start (options: any) {
  let startTime: number | null = null
  let child!: ChildProcess
  let attempts = 0
  let starts = 0
  let wait = 1

  /**
   * Monitor the process to make sure it is running
   */
  function monitor () {
    if (!child.pid) {
      // If the number of periodic starts exceeds the max, kill the process
      if (starts >= options.maxRetries) {
        if ((Date.now() - startTime!) > maxMilliseconds) {
          console.error(
            `Too many restarts within the last ${maxMilliseconds / 1000} seconds. Please check the script.`
          )
          process.exit(1)
        }
      }

      setTimeout(() => {
        wait = wait * options.growPercentage
        attempts += 1
        if (attempts > options.maxRestarts && options.maxRestarts >= 0) {
          console.error(
            `${options.name} will not be restarted because the maximum number of total restarts has been exceeded.`
          )
          process.exit()
        } else {
          launch()
        }
      }, wait)
    } else {
      attempts = 0
      wait = options.restartDelay * 1000
    }
  }

  /**
   * @method launch
   * A method to start a process.
   */
  function launch () {
    // Set the start time if it's null
    if (startTime === null) {
      startTime = startTime || Date.now()
      setTimeout(() => {
        startTime = null
        starts = 0
      }, ( maxMilliseconds ) + 2000)
    }
    starts += 1

    // Fork the child process piping stdin/out/err to the parent
    child = spawn(options.processExec, ['start'].concat(process.argv.slice(2)), {
      env: process.env
    })

    child.stdout!.on('data', function (data) {
      process.stdout.write(data.toString())
    })

    child.stderr!.on('data', function (data) {
      process.stderr.write(data.toString())
    })

    // When the child dies, attempt to restart based on configuration
    child.on('exit', (code) => {
      // If an error is thrown and the process is configured to exit, then kill the parent.
      if (code !== 0 && options.exitOnError) {
        console.error(`${options.name} exited with error code ${code}`)
        process.exit()
      }

      // delete child.pid

      monitor()
    })
  }

  process.on('exit', () => {
    child.removeAllListeners('exit')
    if (child) {
      child.kill()
    }
  })

  process.on('SIGTERM', () => {
    child.removeAllListeners('exit')
    child.kill()
  })

  process.on('SIGHUP', () => {
    child.removeAllListeners('exit')
    child.kill()
  })

  process.on('SIGINT', () => {
    child.removeAllListeners('exit')
    child.kill()
  })

  launch()
}

export const start = (daemonOptions: any) => {
  const options = daemonOptions || {}
  _start({
    name: 'deepstream',
    exitOnError: false,
    growPercentage: 0.25,
    maxRetries: 10,
    restartDelay: 1,
    ...options
  })
}
