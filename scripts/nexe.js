const nexe = require('nexe') // eslint-disable-line

nexe.compile({
  flags: true,
  input: 'bin/deepstream',
  output: process.env.EXECUTABLE_NAME,
  nodeVersion: process.env.NODE_VERSION_WITHOUT_V,
  nodeTempDir: 'nexe_node',
  framework: 'node',
  resourceFiles: [
    'ascii-logo.txt'
  ]
},
  error => {
    if (error) {
      return console.error(error.message)
    }
  }
)
