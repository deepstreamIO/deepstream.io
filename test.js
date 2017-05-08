const deepstream = require('./src/deepstream.io')
const deepstreamClient = require('deepstream.io-client-js')

const server = new deepstream('./conf/config.yml')

//server.set('custom', function() {})

server.on('started', connectClients)

server.start()

function connectClients() {
  const client = deepstreamClient('localhost:6020')
  //const client2 = deepstreamClient('localhost:6020')

  client.login({}, t => console.log(t))
  //client2.login({}, t => console.log(t))

  setTimeout(() => {
    //client2.event.subscribe('test', console.log)
    client.event.emit('test', 'some data')
  }, 500)

}
