const deepstream = require('./deepstream.io')

const server = new deepstream()

server.start()

setTimeout(() => server.stop(), 1000)
