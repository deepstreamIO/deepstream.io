const { exec } = require('child_process')

exec('./build/deepstream info', (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`)
        process.exit(1)
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`)
        process.exit(1)
    }
    process.exit(0)
})