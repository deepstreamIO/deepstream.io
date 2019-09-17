const { Deepstream } = require('../dist/src/deepstream.io')

const server = new Deepstream({})
server.start()
server.on('stopped', () => process.exit(0))
setTimeout(() => server.stop(), 2000)
