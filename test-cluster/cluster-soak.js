'use strict'
const ClusterNode = require('../src/cluster/cluster-node')
const utils = require('../src/utils/utils')

const ports = []

module.exports = function (program) {
  program
    .command('soak')
    .description('start a deepstream server')

    .option('--states <states>', 'amount of states')
    .option('--subscriptions <subscriptions>', 'total amount of subscriptions')
    .option('--nodes <nodes>', 'amount of nodes')
    .option('--node-rate <node-rate>', 'time between add/removing nodes')
    .option('--subscription-rate <subscription-rate>', 'time between add/removing subscriptions')

    .action(action)
}

const clusters = {}

function createClusterNode (port, seedNodes) {
  clusters[port] = new ClusterNode({
    serverName: utils.getUid(),
    logger: { log: console.log },
    messageConnector: {
      host: 'localhost',
      port,
      seedNodes,
      maxReconnectAttempts: 4,
      reconnectInterval: 1500,
      pingTimeout: 500,
      pingInterval: 1000
    }
  })
  setInterval(() => {
    clusters[port].getAll()
  }, 5000)
}

function action () {
  const seedNodes = []
  for (let i = 0; i < (this.nodes || 2); i++) {
    ports.push(3030 + i)
    seedNodes.push(`localhost:${3030 + i}`)
  }

  for (let i = 0; i < ports.length; i++) {
    setTimeout(() => { // eslint-disable-line
      createClusterNode(3030 + i, seedNodes)
    }, 1000 * i)
  }
}
